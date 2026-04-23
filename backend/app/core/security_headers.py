"""
Security Headers Configuration for Synapse API.

Defines the complete set of HTTP security headers applied to every API
response via SecurityHeadersMiddleware (see middleware.py).

Headers applied:
    - X-Content-Type-Options: nosniff          — Prevents MIME-type sniffing
    - X-Frame-Options: DENY                    — Prevents clickjacking
    - X-XSS-Protection: 1; mode=block          — Legacy XSS filter
    - Referrer-Policy: no-referrer              — Prevents referrer leakage
    - Content-Security-Policy                   — Restricts resource loading
    - Strict-Transport-Security (prod only)     — Enforces HTTPS
    - Permissions-Policy                        — Restricts browser features
    - Cache-Control (API responses)             — Prevents sensitive data caching

Reference: https://owasp.org/www-project-secure-headers/
See also: app/core/middleware.py (where these are applied).
"""
from app.core.config import settings


# ── Security header definitions ───────────────────────────────────────────

# Content Security Policy — restricts which resources the browser can load.
CONTENT_SECURITY_POLICY = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "connect-src 'self' https://generativelanguage.googleapis.com https://api.elevenlabs.io; "
    "img-src 'self' data: https://fastapi.tiangolo.com; "
    "frame-ancestors 'none';"
)

# Permissions Policy — disables unnecessary browser features.
PERMISSIONS_POLICY = (
    "camera=(), microphone=(), geolocation=(), "
    "payment=(), usb=(), magnetometer=()"
)

# Complete header map applied to every response.
SECURITY_HEADERS: dict[str, str] = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": CONTENT_SECURITY_POLICY,
    "Permissions-Policy": PERMISSIONS_POLICY,
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    "Pragma": "no-cache",
}

# HSTS — only in production (breaks local dev over HTTP).
HSTS_HEADER = "max-age=31536000; includeSubDomains"


def get_security_headers() -> dict[str, str]:
    """Return the full set of security headers for the current environment.

    In production, includes Strict-Transport-Security (HSTS).
    In development, HSTS is omitted to avoid HTTPS enforcement on localhost.
    """
    headers = dict(SECURITY_HEADERS)
    if settings.ENVIRONMENT == "production":
        headers["Strict-Transport-Security"] = HSTS_HEADER
    return headers
