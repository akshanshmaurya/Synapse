"""
CORS Configuration for Synapse API.

Controls which origins can make cross-origin requests to this API.
In development: allows localhost frontend origins.
In production: restricts to the configured CORS_ORIGINS environment variable.

Security rationale: Combined with SameSite=Lax cookies and JSON-only API,
this provides defense-in-depth against cross-origin attacks.
"""
from app.core.config import settings
from typing import List
import logging

logger = logging.getLogger(__name__)


def get_cors_origins() -> List[str]:
    """
    Returns the list of allowed CORS origins from configuration.
    Supports both comma-separated string and JSON array formats.
    """
    origins = settings.get_cors_origins()
    logger.info("CORS allowed origins: %s", origins)
    return origins


CORS_CONFIG = {
    "allow_origins": get_cors_origins(),
    "allow_credentials": True,
    "allow_methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
}
