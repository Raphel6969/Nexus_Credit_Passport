// Nexus Credit Passport — Scoring Service
//
// Trust zone: RAW ZONE (TEE-bound in production).
// This is the only service that:
//   1. Connects directly to Postgres and reads financial aggregate data
//   2. Loads the credit scoring model and runs inference
//   3. Computes SHAP-style driver attribution
//
// The API layer (FastAPI) never sees raw feature data — it only receives
// { business_id } and gets back a score + driver breakdown.
//
// Startup sequence:
//   1. Connect to Postgres (DATABASE_URL env var)
//   2. Load model from MODEL_PATH (default: /app/model/model_meta.json)
//   3. Serve POST /v1/score + GET /healthz

use std::{net::SocketAddr, path::PathBuf, sync::Arc};

use axum::{
    extract::{Json, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::postgres::PgPoolOptions;
use uuid::Uuid;

mod explain;
mod features;
mod health;
mod model;
mod score;

use features::FeatureExtractor;
use score::engine::ScoringEngine;

// ── Shared application state ─────────────────────────────────────────────────

#[derive(Clone)]
struct AppState {
    db: sqlx::PgPool,
    engine: Arc<ScoringEngine>,
}

// ── Request / Response types ──────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct ScoreRequest {
    business_id: String,
}

#[derive(Debug, Serialize)]
struct ScoreResponse {
    business_id: String,
    score: u16,
    /// "LOW" | "MEDIUM" | "HIGH"
    confidence: String,
    /// Plain-English summary note
    note: String,
    model_version: String,
    drivers: Vec<explain::ScoreDriver>,
}

// ── Handler ───────────────────────────────────────────────────────────────────

async fn handle_score(
    State(state): State<AppState>,
    Json(req): Json<ScoreRequest>,
) -> impl IntoResponse {
    // Validate business_id is a valid UUID
    let business_id = match Uuid::parse_str(&req.business_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "business_id must be a valid UUID v4" })),
            )
                .into_response();
        }
    };

    // Extract all 12 features from Postgres (raw zone — only non-PII aggregates)
    let extractor = FeatureExtractor::new(state.db.clone());
    let features = match extractor.extract(business_id).await {
        Ok(f) => f,
        Err(e) => {
            tracing::error!(
                business_id = %business_id,
                error = %e,
                "Feature extraction failed"
            );
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("feature extraction failed: {}", e) })),
            )
                .into_response();
        }
    };

    // Run linear inference + SHAP attribution
    let result = state.engine.score(&features);

    let note = format!(
        "Score computed by Nexus Credit Passport {} from {} financial features \
        extracted across bank, GST, payment gateway, and accounting data sources.",
        result.model_version,
        features.as_vec().len(),
    );

    let response = ScoreResponse {
        business_id: req.business_id,
        score: result.score,
        confidence: result.confidence,
        note,
        model_version: result.model_version,
        drivers: result.drivers,
    };

    (StatusCode::OK, Json(json!(response))).into_response()
}

// ── Startup ───────────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() {
    // Initialise tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "scoring=info,sqlx=warn".into()),
        )
        .init();

    // Load .env for local development (no-op in Docker where vars come from env_file)
    dotenvy::dotenv().ok();

    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let model_path = std::env::var("MODEL_PATH")
        .unwrap_or_else(|_| "/app/model/model_meta.json".to_string());

    // Connect to Postgres
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to Postgres");
    tracing::info!("Database connection pool established");

    // Load scoring model (panics on failure — correct; we cannot score without a model)
    let engine = ScoringEngine::load(&PathBuf::from(&model_path))
        .expect("Failed to load scoring model — run infra/scripts/train_model.py first");

    let state = AppState {
        db: pool,
        engine: Arc::new(engine),
    };

    let app = Router::new()
        .route("/healthz", get(health::healthz))
        .route("/v1/score", post(handle_score))
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 8081));
    tracing::info!("Scoring service listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .unwrap();
    axum::serve(listener, app).await.unwrap();
}
