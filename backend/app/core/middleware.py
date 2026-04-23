"""
Security Headers Middleware for Synapse API.

Sets the following HTTP security headers on every response:
- Content-Security-Policy (CSP): restricts resource loading to same origin
- Strict-Transport-Security (HSTS): enforces HTTPS in production
- X-Frame-Options: DENY — prevents clickjacking
- X-Content-Type-Options: nosniff — prevents MIME sniffing
- X-XSS-Protection: 1; mode=block — legacy XSS protection for older browsers
- Referrer-Policy: no-referrer — prevents referrer leakage
- Permissions-Policy: disables camera, microphone, geolocation, payment
- Cache-Control: no-store — prevents sensitive data caching

OWASP Top 10 compliance: A05:2021 (Security Misconfiguration)
See: app/core/security_headers.py for the complete header definitions.
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
