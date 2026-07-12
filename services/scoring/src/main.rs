use axum::{routing::get, Router};
use std::net::SocketAddr;

mod health;
mod model;

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/healthz", get(health::healthz));

    let addr = SocketAddr::from(([0, 0, 0, 0], 8081));
    println!("Scoring service listening on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
