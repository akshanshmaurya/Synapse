"""
Centralized Configuration
All secrets and settings loaded from environment variables via pydantic-settings.
No hardcoded secrets anywhere in the codebase.
"""
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # --- Database ---
    MONGO_URI: str
    MONGODB_DB: str

    # --- Authentication ---
    JWT_SECRET: str  # No default — must be set in .env
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30   # 30 minutes
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7      # 7 days

    # --- AI / LLM ---
    GEMINI_API_KEY: str  # No default — must be set in .env

    # --- External Services ---
    ELEVENLABS_API_KEY: str = ""  # Optional — TTS won't work without it

    # --- Application ---
    ENVIRONMENT: str = "development"  # development | production

    # --- CORS ---
    # Set as a comma-separated string in .env, e.g.:
    #   CORS_ORIGINS=https://app.yoursite.com,https://yoursite.com
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        """Allow CORS_ORIGINS to be supplied as a comma-separated env string."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    # --- Cookies ---
    # Set to your apex domain, e.g.:
    #   COOKIE_DOMAIN=yoursite.com
    COOKIE_DOMAIN: str = "localhost"

    model_config = {
        "env_file": os.path.join(os.path.dirname(__file__), "..", "..", ".env"),
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "extra": "ignore",
    }


settings = Settings()
