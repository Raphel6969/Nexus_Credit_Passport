use axum::{routing::get, routing::post, Router};
use std::net::SocketAddr;

mod health;
mod model;
mod score;

use score::{ScoringInput, compute_score};
use axum::{extract::Json, http::StatusCode, response::IntoResponse};
use serde_json::json;

async fn handle_score(Json(input): Json<ScoringInput>) -> impl IntoResponse {
    let output = compute_score(&input);
    (StatusCode::OK, Json(json!(output)))
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/healthz", get(health::healthz))
        .route("/v1/score", post(handle_score));

    let addr = SocketAddr::from(([0, 0, 0, 0], 8081));
    println!("Scoring service listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
