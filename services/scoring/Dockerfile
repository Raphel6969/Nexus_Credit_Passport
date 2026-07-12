# Build stage
FROM rust:1.97-slim AS builder
WORKDIR /app
COPY . .
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim
WORKDIR /app
COPY --from=builder /app/target/release/scoring /usr/local/bin/scoring
EXPOSE 8081
CMD ["scoring"]
