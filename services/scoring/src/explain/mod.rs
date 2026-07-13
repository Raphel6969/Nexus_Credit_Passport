// SHAP-style driver formatter.
//
// For a linear model, SHAP is exact:
//   contribution_i = coefficient_i × z_score_i
//
// format_drivers() converts raw SHAP values into a ranked, human-readable
// list of score drivers (top-5 strengths + top-3 weaknesses), each with:
//   - feature name (machine-readable)
//   - human label
//   - direction: "positive" | "negative"
//   - impact: score-point contribution (± float)
//   - raw_value: actual feature value for the business
//   - human_note: plain-English sentence about what this means

use std::collections::HashMap;

use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
pub struct ScoreDriver {
    pub feature: String,
    pub label: String,
    /// "positive" = boosts score, "negative" = drags score
    pub direction: String,
    /// SHAP contribution in score-points (2 d.p.)
    pub impact: f64,
    /// Actual feature value for this business (2 d.p.)
    pub raw_value: f64,
    /// Plain-English sentence explaining this driver
    pub human_note: String,
}

/// Convert raw SHAP values → top-5 strengths + top-3 weaknesses.
///
/// # Arguments
/// * `feature_names`  — ordered list matching model_meta.json FEATURE_NAMES
/// * `feature_labels` — display names from model_meta.json
/// * `raw_values`     — un-normalized feature values (same order)
/// * `shap_values`    — per-feature score-point contributions
pub fn format_drivers(
    feature_names: &[String],
    feature_labels: &HashMap<String, String>,
    raw_values: &[f64],
    shap_values: &[f64],
) -> Vec<ScoreDriver> {
    let mut drivers: Vec<ScoreDriver> = feature_names
        .iter()
        .enumerate()
        .map(|(i, name)| {
            let shap = shap_values.get(i).copied().unwrap_or(0.0);
            let raw = raw_values.get(i).copied().unwrap_or(0.0);
            let label = feature_labels
                .get(name)
                .cloned()
                .unwrap_or_else(|| name.clone());
            let direction = if shap >= 0.0 { "positive" } else { "negative" }.to_string();
            let human_note = generate_note(name, raw, shap);

            ScoreDriver {
                feature: name.clone(),
                label,
                direction,
                impact: round2(shap),
                raw_value: round2(raw),
                human_note,
            }
        })
        .collect();

    // Sort by |impact| descending
    drivers.sort_by(|a, b| {
        b.impact
            .abs()
            .partial_cmp(&a.impact.abs())
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let positives: Vec<ScoreDriver> = drivers
        .iter()
        .filter(|d| d.impact >= 0.0)
        .take(5)
        .cloned()
        .collect();

    let negatives: Vec<ScoreDriver> = drivers
        .iter()
        .filter(|d| d.impact < 0.0)
        .take(3)
        .cloned()
        .collect();

    let mut result = positives;
    result.extend(negatives);
    result
}

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

fn generate_note(feature: &str, raw: f64, shap: f64) -> String {
    let positive = shap >= 0.0;
    match feature {
        "total_transactions" => format!(
            "{} transactions on record — {}.",
            raw as u64,
            if positive { "strong transaction history supports a confident score" }
            else { "limited transaction data reduces score confidence" }
        ),
        "upi_ratio" => format!(
            "{:.0}% of transactions via UPI — {}.",
            raw * 100.0,
            if positive { "high digital payment adoption signals modern financial behaviour" }
            else { "low UPI usage suggests limited digital payment adoption" }
        ),
        "credit_debit_ratio" => format!(
            "{:.2}× credit-to-debit ratio — {}.",
            raw,
            if positive { "cash inflows consistently exceed outflows (positive cash flow)" }
            else { "cash outflows are outpacing inflows; watch working capital" }
        ),
        "nach_debit_count" => format!(
            "{} NACH/EMI mandates active — {}.",
            raw as u64,
            if positive { "manageable loan commitments relative to revenue" }
            else { "high existing debt obligations reduce borrowing capacity" }
        ),
        "avg_monthly_revenue_lakh" => format!(
            "₹{:.1}L average monthly revenue — {}.",
            raw,
            if positive { "healthy revenue base relative to peer MSMEs" }
            else { "revenue base is below the peer-group median; scale signals weigh on score" }
        ),
        "gst_compliance_ratio" => format!(
            "{:.0}% GST filings submitted on time — {}.",
            raw * 100.0,
            if positive { "strong tax compliance record; lenders view this favourably" }
            else { "irregular GST filing history; compliance gaps reduce lender confidence" }
        ),
        "gst_turnover_lakh" => format!(
            "₹{:.1}L declared annual GST turnover — {}.",
            raw,
            if positive { "significant declared business scale provides credibility" }
            else { "low declared turnover limits verifiable revenue proof points" }
        ),
        "current_balance_lakh" => format!(
            "₹{:.2}L current account balance — {}.",
            raw,
            if positive { "adequate liquidity buffer relative to monthly obligations" }
            else { "low liquidity reserves limit short-term repayment capacity" }
        ),
        "invoice_overdue_ratio" => format!(
            "{:.0}% of receivables are overdue — {}.",
            raw * 100.0,
            if positive { "excellent receivables collection; customers pay on time" }
            else { "high overdue receivables signal collection risk and working capital stress" }
        ),
        "data_window_months" => format!(
            "{:.0} months of financial history available — {}.",
            raw,
            if positive { "sufficient history to build a high-confidence credit picture" }
            else { "limited historical data reduces scoring confidence" }
        ),
        "transaction_velocity" => format!(
            "{:.1} transactions/month on average — {}.",
            raw,
            if positive { "active business with regular, consistent transaction flow" }
            else { "low transaction activity makes cash flow patterns harder to verify" }
        ),
        "revenue_consistency" => format!(
            "{:.0}% revenue consistency score — {}.",
            raw * 100.0,
            if positive { "stable, predictable cash flows reduce lender risk perception" }
            else { "volatile or inconsistent revenue patterns increase lender risk" }
        ),
        _ => format!(
            "Feature '{}': value {:.2}, score impact {:.2}.",
            feature, raw, shap
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_test_data() -> (Vec<String>, HashMap<String, String>, Vec<f64>, Vec<f64>) {
        let names: Vec<String> = vec![
            "total_transactions".into(),
            "upi_ratio".into(),
            "credit_debit_ratio".into(),
        ];
        let mut labels = HashMap::new();
        labels.insert("total_transactions".into(), "Transaction Volume".into());
        labels.insert("upi_ratio".into(), "UPI Adoption Rate".into());
        labels.insert("credit_debit_ratio".into(), "Cash Flow Ratio".into());
        let raw = vec![120.0, 0.65, 1.3];
        let shap = vec![15.0, -5.0, 20.0];
        (names, labels, raw, shap)
    }

    #[test]
    fn drivers_sorted_by_absolute_impact() {
        let (names, labels, raw, shap) = make_test_data();
        let drivers = format_drivers(&names, &labels, &raw, &shap);
        // should be: cash_flow (20) → total_txns (15) → upi (-5)
        let impacts: Vec<f64> = drivers.iter().map(|d| d.impact).collect();
        assert_eq!(impacts[0], 20.0);
        assert_eq!(impacts[1], 15.0);
        assert_eq!(impacts[2], -5.0);
    }

    #[test]
    fn positive_drivers_come_before_negative() {
        let (names, labels, raw, shap) = make_test_data();
        let drivers = format_drivers(&names, &labels, &raw, &shap);
        let positives: Vec<_> = drivers.iter().filter(|d| d.direction == "positive").collect();
        let negatives: Vec<_> = drivers.iter().filter(|d| d.direction == "negative").collect();
        assert_eq!(positives.len(), 2);
        assert_eq!(negatives.len(), 1);
    }

    #[test]
    fn human_notes_are_non_empty() {
        let (names, labels, raw, shap) = make_test_data();
        let drivers = format_drivers(&names, &labels, &raw, &shap);
        for d in &drivers {
            assert!(!d.human_note.is_empty(), "human_note should not be empty");
        }
    }
}
