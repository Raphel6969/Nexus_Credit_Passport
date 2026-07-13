pub mod stub;
pub mod engine;
// Stub re-exports kept for unit tests and fallback scenarios
pub use stub::{ScoringInput, ScoringOutput, compute_score};
