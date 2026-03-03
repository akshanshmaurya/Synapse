"""
Centralized Configuration
All secrets and settings loaded from environment variables via pydantic-settings.
No hardcoded secrets anywhere in the codebase.
"""
from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # --- Database ---
    MONGO_URI: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "synapse"

    # --- Authentication ---
    JWT_SECRET: str  # No default — must be set in .env
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    # --- AI / LLM ---
    GEMINI_API_KEY: str  # No default — must be set in .env

    # --- External Services ---
    ELEVENLABS_API_KEY: str = ""  # Optional — TTS won't work without it

    # --- Application ---
    ENVIRONMENT: str = "development"  # development | production
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]

    model_config = {
        "env_file": os.path.join(os.path.dirname(__file__), "..", "..", ".env"),
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "extra": "ignore",
    }


settings = Settings()
