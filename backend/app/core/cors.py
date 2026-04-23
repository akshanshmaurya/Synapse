"""
CORS (Cross-Origin Resource Sharing) Configuration for Synapse API.

Configures allowed origins, methods, and headers for cross-origin requests.
Origins are loaded from environment variables via the centralized Settings
class — no origins are hardcoded in application code.

Security model:
    - Production: Only explicitly listed origins in CORS_ORIGINS env var.
    - Development: Defaults to localhost:3000 and localhost:5173.
    - Credentials (cookies) are always required — SameSite=Lax + CORS.
    - Preflight responses are cached for 10 minutes (max_age=600).

Reference: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
See also: app/core/csrf.py for complementary CSRF protection.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings


# ── Explicit CORS header configuration ────────────────────────────────────
# These are the exact headers allowed/exposed in cross-origin requests.

ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]

ALLOWED_HEADERS = [
    "Content-Type",
    "Authorization",
    "Accept",
    "Origin",
    "X-Requested-With",
]

EXPOSED_HEADERS = [
    "Content-Type",
    "X-Request-Id",
]


def configure_cors(app: FastAPI) -> None:
    """Apply CORS middleware to the FastAPI application.

    Reads allowed origins from ``settings.get_cors_origins()`` which
    parses the CORS_ORIGINS environment variable (supports JSON array,
    comma-separated list, or single origin).

    Args:
        app: The FastAPI application instance.
    """
    origins = settings.get_cors_origins()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=ALLOWED_METHODS,
        allow_headers=ALLOWED_HEADERS,
        expose_headers=EXPOSED_HEADERS,
        max_age=600,  # Cache preflight responses for 10 minutes
    )
