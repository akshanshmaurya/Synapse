"""
Security Middleware for Synapse API.

Applies HTTP security headers to every response using the centralized
header definitions from security_headers.py.

Headers include: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection,
Referrer-Policy, Content-Security-Policy, Permissions-Policy, Cache-Control,
and Strict-Transport-Security (production only).

See: app/core/security_headers.py for the complete header list and docs.
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from app.core.security_headers import get_security_headers


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Injects security headers into every HTTP response.

    Uses the centralized header definitions from security_headers.py
    so all security headers are documented and configurable in one place.
    """

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        # Apply all security headers from the centralized configuration
        for header_name, header_value in get_security_headers().items():
            response.headers[header_name] = header_value

        return response
