"""
Centralized Configuration
All secrets and settings loaded from environment variables via pydantic-settings.
No hardcoded secrets anywhere in the codebase.
"""
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List
import logging
import json
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
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # --- Pipeline Limits ---
    # Max items kept in capped arrays (MongoDB $slice)
    MAX_EVALUATION_HISTORY: int = 20
    MAX_SESSION_DATES: int = 100
    MAX_RECENT_MESSAGES: int = 10
    MAX_STRUGGLES: int = 20
    # Session context TTL in days (MongoDB TTL index)
    SESSION_CONTEXT_TTL_DAYS: int = 30

    # --- External Services ---
    ELEVENLABS_API_KEY: str = ""  # Optional — TTS won't work without it

    # --- Application ---
    ENVIRONMENT: str = "development"  # development | production

    # --- CORS ---
    # Stored as a plain string to prevent pydantic-settings from
    # attempting (and failing) JSON decoding of env-var values.
    # Accepts: JSON array, comma-separated list, or a single origin.
    #   CORS_ORIGINS=https://app.yoursite.com,https://yoursite.com
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    def get_cors_origins(self) -> List[str]:
        """Parse CORS_ORIGINS string into a list of origin URLs."""
        v = self.CORS_ORIGINS.strip()
        # Handle JSON array format (e.g. '["http://localhost:5173"]')
        if v.startswith("["):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return [o.strip() for o in parsed if isinstance(o, str) and o.strip()]
            except (json.JSONDecodeError, TypeError) as ex:
                logging.getLogger(__name__).warning(
                    "Malformed JSON for CORS_ORIGINS: %r", v, exc_info=ex
                )
        # Comma-separated or single origin
        return [origin.strip() for origin in v.split(",") if origin.strip()]

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
