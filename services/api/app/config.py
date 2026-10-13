"""Application configuration and settings."""

import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_ENV: str = "development"
    ACCESS_MODE: str = "local"  # "local", "public_owner", "public_readonly"
    DATABASE_URL: str = "postgresql+psycopg://persona:persona@localhost:5432/persona"
    DATA_DIR: str = str(Path(__file__).parents[3] / "data")
    APP_ORIGIN: str = "http://localhost:3000"
    API_INTERNAL_URL: str = "http://localhost:8000"
    DEFAULT_CURRENCY: str = "INR"
    DEFAULT_TIMEZONE: str = "Asia/Kolkata"
    DEMO_SEED: int = 42
    MAX_UPLOAD_MB: int = 25
    MAX_CUSTOMERS: int = 10000
    MAX_ORDER_LINES: int = 100000
    MAX_EVENTS: int = 100000
    WORKER_CONCURRENCY: int = 1
    OMP_NUM_THREADS: int = 1
    OPENBLAS_NUM_THREADS: int = 1
    MKL_NUM_THREADS: int = 1
    LLM_PROVIDER: str = "none"  # "none", "gemini"
    GEMINI_API_KEY: str | None = None
    GEMINI_MODEL: str = "gemini-2.5-flash"
    OWNER_PASSWORD_HASH: str | None = None
    SESSION_SECRET: str = "persona-studio-local-session-secret-at-least-32-chars"


settings = Settings()

# Ensure local data directory exists
os.makedirs(settings.DATA_DIR, exist_ok=True)
