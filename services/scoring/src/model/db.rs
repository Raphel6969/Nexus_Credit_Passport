use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Business {
    pub id: String, // Stored as UUID in DB, can use uuid::Uuid later
    pub name: String,
    pub pan_hash: String,
    pub gstin: Option<String>,
    pub created_at: String, // Use chrono::DateTime<chrono::Utc> when sqlx is added
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Account {
    pub id: String,
    pub business_id: String,
    pub source_type: String,
    pub fi_type: Option<String>,
    pub account_ref: String,
    pub status: String,
    pub last_synced_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Counterparty {
    pub id: String,
    pub business_id: String,
    pub name: Option<String>, // Encrypted
    pub r#type: String,
    pub identifier: Option<String>, // Encrypted
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Transaction {
    pub id: String,
    pub account_id: String,
    pub counterparty_id: Option<String>,
    pub amount: i64, // Minor units (paise)
    pub currency: String,
    pub r#type: String,
    pub timestamp: String,
    pub description: Option<String>, // Encrypted
    pub reference_number: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CashFlowEvent {
    pub id: String,
    pub business_id: String,
    pub transaction_id: Option<String>,
    pub event_type: String,
    pub amount: i64,
    pub currency: String,
    pub timestamp: String,
    pub created_at: String,
    pub updated_at: String,
}
