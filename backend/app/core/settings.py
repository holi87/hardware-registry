from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "Hardware Registry API"
    APP_ENV: str = "dev"
    API_LOG_LEVEL: str = "INFO"
    DATABASE_URL: str = "postgresql+psycopg://hardware_registry:change-me-db-password@db:5432/hardware_registry"
    JWT_SECRET: str = "change-me-jwt-secret"
    APP_ENCRYPTION_KEY: str = "change-me-encryption-key"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
