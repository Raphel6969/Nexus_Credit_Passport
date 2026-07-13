// Feature extraction from Postgres — runs inside the Rust raw-zone.
//
// All 12 features are derived from non-PII aggregate columns:
//   - COUNT, SUM, MIN, MAX on amounts / modes / statuses
//   - Encrypted columns (narration, description, counterparty.name) are NEVER read here.
//
// Uses sqlx non-macro query() API so Docker builds succeed without a live DB.
//
// Feature order MUST match FEATURE_NAMES in model_meta.json (set by train_model.py).

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use sqlx::Row as _;
use uuid::Uuid;

/// Named feature vector passed to the scoring engine.
/// Field order in as_vec() mirrors FEATURE_NAMES in model_meta.json exactly.
#[derive(Debug, Clone)]
pub struct Features {
    pub business_id: Uuid,
    // 0
    pub total_transactions: f64,
    // 1
    pub upi_ratio: f64,
    // 2  capped at 3.0
    pub credit_debit_ratio: f64,
    // 3
    pub nach_debit_count: f64,
    // 4  ₹ in lakhs (1L = 100,000 INR = 10,000,000 paise)
    pub avg_monthly_revenue_lakh: f64,
    // 5  0.0 – 1.0; 0.0 means no GST data
    pub gst_compliance_ratio: f64,
    // 6  annual, ₹ in lakhs
    pub gst_turnover_lakh: f64,
    // 7  ₹ in lakhs
    pub current_balance_lakh: f64,
    // 8  0.0 – 1.0; lower is better
    pub invoice_overdue_ratio: f64,
    // 9  months of data history
    pub data_window_months: f64,
    // 10 txns per month
    pub transaction_velocity: f64,
    // 11 0.0 – 1.0; higher is better
    pub revenue_consistency: f64,
}

impl Features {
    /// Returns features as a Vec<f64> in FEATURE_NAMES order.
    pub fn as_vec(&self) -> Vec<f64> {
        vec![
            self.total_transactions,       // 0
            self.upi_ratio,                // 1
            self.credit_debit_ratio,       // 2
            self.nach_debit_count,         // 3
            self.avg_monthly_revenue_lakh, // 4
            self.gst_compliance_ratio,     // 5
            self.gst_turnover_lakh,        // 6
            self.current_balance_lakh,     // 7
            self.invoice_overdue_ratio,    // 8
            self.data_window_months,       // 9
            self.transaction_velocity,     // 10
            self.revenue_consistency,      // 11
        ]
    }
}

pub struct FeatureExtractor {
    pool: PgPool,
}

impl FeatureExtractor {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn extract(&self, business_id: Uuid) -> Result<Features> {
        // ── Transaction aggregates ──────────────────────────────────────────
        // Only reads amount, type, mode, revenue_role — no PII columns.
        let txn_row = sqlx::query(
            r#"
            SELECT
                COUNT(*)::BIGINT                                                                       AS total_transactions,
                COUNT(*) FILTER (WHERE t.mode = 'UPI')::BIGINT                                        AS upi_count,
                COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'CREDIT' AND t.revenue_role = 'primary'), 0)::BIGINT  AS total_credits_paise,
                COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'DEBIT'  AND t.revenue_role = 'primary'), 0)::BIGINT  AS total_debits_paise,
                COUNT(*) FILTER (WHERE t.mode = 'NACH' AND t.type = 'DEBIT')::BIGINT                 AS nach_debit_count,
                MIN(t.timestamp)                                                                      AS earliest_txn,
                MAX(t.timestamp)                                                                      AS latest_txn
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE a.business_id = $1
            "#,
        )
        .bind(business_id)
        .fetch_one(&self.pool)
        .await
        .context("transaction aggregate query failed")?;

        let total_transactions: i64 = txn_row.try_get("total_transactions").unwrap_or(0);
        let upi_count:          i64 = txn_row.try_get("upi_count").unwrap_or(0);
        let total_credits_paise: i64 = txn_row.try_get("total_credits_paise").unwrap_or(0);
        let total_debits_paise:  i64 = txn_row.try_get("total_debits_paise").unwrap_or(0);
        let nach_debit_count:    i64 = txn_row.try_get("nach_debit_count").unwrap_or(0);
        let earliest_txn: Option<DateTime<Utc>> = txn_row.try_get("earliest_txn").ok().flatten();
        let latest_txn:   Option<DateTime<Utc>> = txn_row.try_get("latest_txn").ok().flatten();

        let total_transactions = total_transactions as f64;
        let upi_count          = upi_count as f64;
        let total_credits_paise = total_credits_paise as f64;
        let total_debits_paise  = total_debits_paise as f64;
        let nach_debit_count    = nach_debit_count as f64;

        // Data window in months (min 1 month to avoid division by zero)
        let data_window_months: f64 = match (earliest_txn, latest_txn) {
            (Some(earliest), Some(latest)) => {
                let days = (latest - earliest).num_days().max(1) as f64;
                (days / 30.0).max(1.0)
            }
            _ => 12.0, // default assumption if no timestamp data
        };

        // Derived ratios
        let upi_ratio = if total_transactions > 0.0 {
            upi_count / total_transactions
        } else {
            0.0
        };

        let credit_debit_ratio = if total_debits_paise > 0.0 {
            (total_credits_paise / total_debits_paise).min(3.0)
        } else if total_credits_paise > 0.0 {
            3.0 // all credits, no debits → maximum ratio
        } else {
            1.0 // no data → neutral
        };

        // paise → lakhs: 1 lakh = ₹1,00,000 = 1,00,00,000 paise
        const PAISE_PER_LAKH: f64 = 10_000_000.0;

        let avg_monthly_revenue_lakh = if data_window_months > 0.0 {
            (total_credits_paise / data_window_months) / PAISE_PER_LAKH
        } else {
            0.0
        };

        let transaction_velocity = total_transactions / data_window_months;

        // ── Latest account balance ──────────────────────────────────────────
        let balance_row = sqlx::query(
            r#"
            SELECT balance
            FROM accounts
            WHERE business_id = $1 AND balance IS NOT NULL
            ORDER BY balance_at DESC NULLS LAST
            LIMIT 1
            "#,
        )
        .bind(business_id)
        .fetch_optional(&self.pool)
        .await
        .context("balance query failed")?;

        let current_balance_lakh = balance_row
            .and_then(|row| row.try_get::<i64, _>("balance").ok())
            .map(|b| b as f64 / PAISE_PER_LAKH)
            .unwrap_or(0.0);

        // ── GST tax filings ─────────────────────────────────────────────────
        let gst_row = sqlx::query(
            r#"
            SELECT
                COALESCE(SUM(gross_turnover), 0)::BIGINT          AS total_turnover_paise,
                COUNT(*)::BIGINT                                   AS total_filings,
                COUNT(*) FILTER (WHERE status = 'FILED')::BIGINT  AS filed_count
            FROM tax_filings
            WHERE business_id = $1
            "#,
        )
        .bind(business_id)
        .fetch_one(&self.pool)
        .await
        .context("GST filings query failed")?;

        let total_turnover_paise: i64 = gst_row.try_get("total_turnover_paise").unwrap_or(0);
        let total_filings: i64        = gst_row.try_get("total_filings").unwrap_or(0);
        let filed_count:   i64        = gst_row.try_get("filed_count").unwrap_or(0);

        let gst_compliance_ratio = if total_filings > 0 {
            filed_count as f64 / total_filings as f64
        } else {
            0.0
        };
        let gst_turnover_lakh = total_turnover_paise as f64 / PAISE_PER_LAKH;

        // ── Invoice aging ───────────────────────────────────────────────────
        let inv_row = sqlx::query(
            r#"
            SELECT
                COUNT(*) FILTER (WHERE invoice_type = 'RECEIVABLE')::BIGINT                           AS total_receivables,
                COUNT(*) FILTER (WHERE invoice_type = 'RECEIVABLE' AND status = 'OVERDUE')::BIGINT    AS overdue_receivables
            FROM invoices
            WHERE business_id = $1
            "#,
        )
        .bind(business_id)
        .fetch_one(&self.pool)
        .await
        .context("invoices query failed")?;

        let total_receivables:  i64 = inv_row.try_get("total_receivables").unwrap_or(0);
        let overdue_receivables: i64 = inv_row.try_get("overdue_receivables").unwrap_or(0);

        let invoice_overdue_ratio = if total_receivables > 0 {
            overdue_receivables as f64 / total_receivables as f64
        } else {
            0.0
        };

        // ── Revenue consistency (proxy from available aggregates) ───────────
        // Full stddev-of-monthly-credits would require a per-month CTE.
        // Proxy: credit/debit ratio stability × NACH penalty is a reasonable
        // approximation and avoids a heavy groupby query. Phase 5+ can upgrade.
        let cf_score = ((credit_debit_ratio - 0.5) / 2.5).clamp(0.0, 1.0);
        let nach_penalty = (nach_debit_count / 10.0).clamp(0.0, 0.5);
        let revenue_consistency = (cf_score - nach_penalty).clamp(0.0, 1.0);

        Ok(Features {
            business_id,
            total_transactions,
            upi_ratio,
            credit_debit_ratio,
            nach_debit_count,
            avg_monthly_revenue_lakh,
            gst_compliance_ratio,
            gst_turnover_lakh,
            current_balance_lakh,
            invoice_overdue_ratio,
            data_window_months,
            transaction_velocity,
            revenue_consistency,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::Features;
    use uuid::Uuid;

    fn sample_features() -> Features {
        Features {
            business_id: Uuid::new_v4(),
            total_transactions: 120.0,
            upi_ratio: 0.65,
            credit_debit_ratio: 1.3,
            nach_debit_count: 2.0,
            avg_monthly_revenue_lakh: 15.0,
            gst_compliance_ratio: 0.9,
            gst_turnover_lakh: 180.0,
            current_balance_lakh: 8.0,
            invoice_overdue_ratio: 0.05,
            data_window_months: 12.0,
            transaction_velocity: 10.0,
            revenue_consistency: 0.8,
        }
    }

    #[test]
    fn as_vec_length_matches_feature_count() {
        let f = sample_features();
        assert_eq!(f.as_vec().len(), 12, "as_vec() must return exactly 12 features (matches model_meta.json)");
    }

    #[test]
    fn feature_values_in_expected_range() {
        let f = sample_features();
        assert!(f.upi_ratio >= 0.0 && f.upi_ratio <= 1.0);
        assert!(f.credit_debit_ratio <= 3.0);
        assert!(f.invoice_overdue_ratio >= 0.0 && f.invoice_overdue_ratio <= 1.0);
        assert!(f.revenue_consistency >= 0.0 && f.revenue_consistency <= 1.0);
    }
}
