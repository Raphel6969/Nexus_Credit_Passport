from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Resolve env file relative to project root (../../ from services/api/)
    # In Docker the vars come via env_file: .env.local in docker-compose.yml
    model_config = SettingsConfigDict(
        env_file=["../../.env.local", ".env.local"],
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str
    API_KEY: str = "dev-secret-change-me-in-prod"
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "dev-jwt-secret-change-me-in-prod"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week

    # Downstream service URLs
    SCORING_SERVICE_URL: str = "http://localhost:8081"
    INGESTION_SERVICE_URL: str = "http://localhost:8080"


settings = Settings()


def get_settings() -> Settings:
    return settings