// Scoring engine — loads model_meta.json at startup, runs linear inference,
// computes exact linear SHAP attribution.
//
// Why linear model + JSON (not XGBoost + ONNX):
//   • Zero external ML-runtime dependency (no ort, no libonnxruntime.so)
//   • Linear SHAP is exact: contribution_i = coeff_i × z_score_i
//   • Model artifact is a plain JSON file — readable, diffable, auditable
//   • Architecture is identical to what ONNX Runtime would produce; swapping
//     in a tree ensemble is a future step when real MSME data is available.
//
// Equation:  score = clamp(intercept + Σ coeff_i × (feature_i - mean_i) / std_i, 300, 850)

use std::{collections::HashMap, path::Path};

use anyhow::{Context, Result};
use serde::Deserialize;

use crate::explain::{format_drivers, ScoreDriver};
use crate::features::Features;

// ── Model metadata (deserialized from model_meta.json) ───────────────────────

#[derive(Debug, Deserialize)]
struct ModelMeta {
    model_version: String,
    feature_names: Vec<String>,
    feature_labels: HashMap<String, String>,
    intercept: f64,
    coefficients: Vec<f64>,
    feature_means: Vec<f64>,
    feature_stds: Vec<f64>,
    score_clamp: ScoreClamp,
}

#[derive(Debug, Deserialize)]
struct ScoreClamp {
    min: f64,
    max: f64,
}

// ── Engine ────────────────────────────────────────────────────────────────────

pub struct ScoringEngine {
    meta: ModelMeta,
}

/// Result of scoring a single business.
pub struct ScoringResult {
    pub score: u16,
    pub confidence: String,
    pub model_version: String,
    pub drivers: Vec<ScoreDriver>,
}

impl ScoringEngine {
    /// Load and validate the model from disk.
    /// Called once at service startup; panics on failure (fast-fail is correct here).
    pub fn load(model_path: &Path) -> Result<Self> {
        let raw = std::fs::read_to_string(model_path)
            .with_context(|| format!("reading model file: {:?}", model_path))?;

        let meta: ModelMeta =
            serde_json::from_str(&raw).context("parsing model_meta.json")?;

        anyhow::ensure!(
            meta.coefficients.len() == meta.feature_names.len(),
            "model_meta.json: coefficients.len() ({}) != feature_names.len() ({})",
            meta.coefficients.len(),
            meta.feature_names.len()
        );
        anyhow::ensure!(
            meta.feature_means.len() == meta.feature_names.len(),
            "model_meta.json: feature_means length mismatch"
        );
        anyhow::ensure!(
            meta.feature_stds.len() == meta.feature_names.len(),
            "model_meta.json: feature_stds length mismatch"
        );

        tracing::info!(
            model_version = %meta.model_version,
            n_features = meta.feature_names.len(),
            "Scoring model loaded successfully"
        );

        Ok(Self { meta })
    }

    /// Score a feature vector and return score + SHAP drivers.
    pub fn score(&self, features: &Features) -> ScoringResult {
        let raw = features.as_vec();

        // Z-score normalization
        let normalized: Vec<f64> = raw
            .iter()
            .enumerate()
            .map(|(i, &v)| {
                let mean = self.meta.feature_means.get(i).copied().unwrap_or(0.0);
                let std = {
                    let s = self.meta.feature_stds.get(i).copied().unwrap_or(1.0);
                    if s == 0.0 { 1.0 } else { s }
                };
                (v - mean) / std
            })
            .collect();

        // Linear inference
        let raw_score: f64 = self.meta.intercept
            + normalized
                .iter()
                .zip(self.meta.coefficients.iter())
                .map(|(x, c)| x * c)
                .sum::<f64>();

        let score = raw_score
            .max(self.meta.score_clamp.min)
            .min(self.meta.score_clamp.max) as u16;

        // Confidence: data richness based on transaction count
        let confidence = if raw[0] >= 100.0 {
            "HIGH"
        } else if raw[0] >= 30.0 {
            "MEDIUM"
        } else {
            "LOW"
        }
        .to_string();

        // Exact linear SHAP: contribution_i = coeff_i × z_score_i
        let shap_values: Vec<f64> = normalized
            .iter()
            .zip(self.meta.coefficients.iter())
            .map(|(x, c)| x * c)
            .collect();

        let drivers = format_drivers(
            &self.meta.feature_names,
            &self.meta.feature_labels,
            &raw,
            &shap_values,
        );

        ScoringResult {
            score,
            confidence,
            model_version: self.meta.model_version.clone(),
            drivers,
        }
    }

    pub fn model_version(&self) -> &str {
        &self.meta.model_version
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::Features;
    use uuid::Uuid;
    use std::io::Write;

    fn write_temp_model() -> tempfile::NamedTempFile {
        let coefficients: Vec<f64> = vec![
            5.0, 10.0, 30.0, -8.0, 15.0, 20.0, 5.0, 10.0, -15.0, 3.0, 4.0, 20.0,
        ];
        let means: Vec<f64> = vec![
            80.0, 0.5, 1.2, 3.0, 10.0, 0.8, 100.0, 5.0, 0.15, 12.0, 6.0, 0.6,
        ];
        let stds: Vec<f64> = vec![
            60.0, 0.25, 0.5, 4.0, 15.0, 0.2, 80.0, 6.0, 0.15, 6.0, 4.0, 0.25,
        ];

        let meta = serde_json::json!({
            "model_version": "test-v0.0.1",
            "model_type": "ridge_regression",
            "description": "test",
            "n_features": 12,
            "feature_names": [
                "total_transactions","upi_ratio","credit_debit_ratio",
                "nach_debit_count","avg_monthly_revenue_lakh","gst_compliance_ratio",
                "gst_turnover_lakh","current_balance_lakh","invoice_overdue_ratio",
                "data_window_months","transaction_velocity","revenue_consistency"
            ],
            "feature_labels": {},
            "intercept": 575.0,
            "coefficients": coefficients,
            "feature_means": means,
            "feature_stds": stds,
            "score_clamp": { "min": 300.0, "max": 850.0 }
        });

        let mut tmp = tempfile::NamedTempFile::new().unwrap();
        tmp.write_all(meta.to_string().as_bytes()).unwrap();
        tmp
    }

    fn good_features() -> Features {
        Features {
            business_id: Uuid::new_v4(),
            total_transactions: 150.0,
            upi_ratio: 0.7,
            credit_debit_ratio: 1.4,
            nach_debit_count: 1.0,
            avg_monthly_revenue_lakh: 20.0,
            gst_compliance_ratio: 0.95,
            gst_turnover_lakh: 240.0,
            current_balance_lakh: 10.0,
            invoice_overdue_ratio: 0.05,
            data_window_months: 18.0,
            transaction_velocity: 8.3,
            revenue_consistency: 0.85,
        }
    }

    #[test]
    fn score_within_clamp_range() {
        let tmp = write_temp_model();
        let engine = ScoringEngine::load(tmp.path()).unwrap();
        let result = engine.score(&good_features());
        assert!(result.score >= 300 && result.score <= 850);
    }

    #[test]
    fn high_quality_business_scores_higher() {
        let tmp = write_temp_model();
        let engine = ScoringEngine::load(tmp.path()).unwrap();

        let good = good_features();
        let mut bad = good.clone();
        bad.credit_debit_ratio = 0.6;
        bad.gst_compliance_ratio = 0.2;
        bad.invoice_overdue_ratio = 0.7;

        let good_score = engine.score(&good).score;
        let bad_score  = engine.score(&bad).score;
        assert!(
            good_score > bad_score,
            "good business ({}) should score higher than bad ({})",
            good_score, bad_score
        );
    }

    #[test]
    fn drivers_count_in_expected_range() {
        let tmp = write_temp_model();
        let engine = ScoringEngine::load(tmp.path()).unwrap();
        let result = engine.score(&good_features());
        // max 8 drivers (5 positive + 3 negative), min 1
        assert!(result.drivers.len() >= 1 && result.drivers.len() <= 8);
    }

    #[test]
    fn confidence_high_for_many_transactions() {
        let tmp = write_temp_model();
        let engine = ScoringEngine::load(tmp.path()).unwrap();
        let mut f = good_features();
        f.total_transactions = 200.0;
        let result = engine.score(&f);
        assert_eq!(result.confidence, "HIGH");
    }
}
