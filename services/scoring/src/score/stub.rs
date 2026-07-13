// Pure scoring function — no DB, no network.
//
// Phase 2: accepts pre-computed aggregate inputs assembled by the API layer,
// returns a stub score. The interface is real even if the model is fake.
//
// Phase 4 will replace compute_score() with a real CatBoost/XGBoost model
// and add SHAP explanations. The input/output structs may evolve but the
// HTTP contract (POST /v1/score) should stay stable.
//
// Rust data-access pattern (direct sqlx vs other) is an EXPLICITLY DEFERRED
// Phase 4 decision — see docs/backlog.md. Do not add DB deps here yet.
use serde::{Deserialize, Serialize};

/// Scoring input assembled by the API/ingestion layer.
/// All PII has already been stripped — only aggregate statistics are passed here.
#[derive(Debug, Deserialize)]
pub struct ScoringInput {
    pub business_id: String,
    pub account_ids: Vec<String>,
    /// Total number of transactions in the data window
    pub total_transactions: u64,
    /// Sum of all CREDIT amounts in paise
    pub total_credits_paise: i64,
    /// Sum of all DEBIT amounts in paise
    pub total_debits_paise: i64,
    /// Count of UPI transactions (indicator of digital payment adoption)
    pub upi_transaction_count: u64,
    /// Count of NACH debits (indicator of loan obligations)
    pub nach_debit_count: u64,
    /// Latest account balance in paise
    pub current_balance_paise: Option<i64>,
    /// GST gross turnover in paise (from tax filings)
    pub gst_turnover_paise: Option<i64>,
    /// Data window in days
    pub data_window_days: u32,
}

/// Scoring output returned to callers.
#[derive(Debug, Serialize)]
pub struct ScoringOutput {
    pub business_id: String,
    /// Credit score in the range 300–850 (Indian bureau scale)
    pub score: u16,
    /// Confidence band: LOW | MEDIUM | HIGH
    pub confidence: String,
    /// Human-readable explanation (Phase 4: SHAP-driven; Phase 2: stub)
    pub note: String,
    /// Version tag so clients know which model produced this
    pub model_version: String,
}

/// Compute a credit score from aggregate transaction features.
///
/// Phase 2 stub: heuristic rules to return a plausible-looking score
/// that varies with input so the pipeline is meaningfully exercisable.
/// Replace entirely in Phase 4 with a trained CatBoost/XGBoost model.
pub fn compute_score(input: &ScoringInput) -> ScoringOutput {
    // Base score
    let mut score: f64 = 500.0;

    // Transaction volume signal (more txns = more data = higher confidence in score)
    if input.total_transactions > 50 {
        score += 30.0;
    } else if input.total_transactions > 20 {
        score += 15.0;
    }

    // Digital payment adoption (UPI ratio)
    if input.total_transactions > 0 {
        let upi_ratio = input.upi_transaction_count as f64 / input.total_transactions as f64;
        score += upi_ratio * 40.0;
    }

    // Cash flow health (credit/debit ratio)
    if input.total_debits_paise > 0 {
        let cf_ratio = input.total_credits_paise as f64 / input.total_debits_paise as f64;
        if cf_ratio > 1.2 {
            score += 50.0;
        } else if cf_ratio > 1.0 {
            score += 20.0;
        } else {
            score -= 30.0;
        }
    }

    // Loan obligation signal (NACH debits = existing debt)
    if input.nach_debit_count > 3 {
        score -= 20.0;
    } else if input.nach_debit_count > 0 {
        score -= 5.0; // Some loans is normal for MSMEs
    }

    // Tax compliance / GST scale signal
    if let Some(turnover) = input.gst_turnover_paise {
        if turnover > 100_000_000 { // > 10L
            score += 40.0;
        } else if turnover > 0 {
            score += 20.0;
        }
    }

    // Clamp to 300–850 range
    let score = score.max(300.0).min(850.0) as u16;

    let confidence = if input.total_transactions >= 50 {
        "MEDIUM"
    } else {
        "LOW"
    };

    ScoringOutput {
        business_id: input.business_id.clone(),
        score,
        confidence: confidence.to_string(),
        note: "Phase 2 stub — replace with trained model in Phase 4".to_string(),
        model_version: "stub-0.1.0".to_string(),
    }
}
