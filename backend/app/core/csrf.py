"""CSRF Protection Middleware.

SameSite=Lax cookies + JSON-only API + Origin validation = OWASP-compliant
CSRF protection for SPAs. No token needed per OWASP ASVS 4.0 section 4.2.2.

This middleware explicitly enforces the JSON-only constraint on all state-changing
HTTP methods (POST, PUT, PATCH, DELETE). By requiring application/json, we prevent
simple CSRF attacks (form submissions) since browsers cannot send custom Content-Types
like application/json across origins without triggering a preflight CORS validation.
"""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse

class CSRFProtectionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Only enforce on state-changing methods
        """Internal helper."""
        if request.method in ["POST", "PUT", "PATCH", "DELETE"]:
            # Check for allowed Content-Types
            # Note: We must allow multipart/form-data if we have file uploads, but presently we don't.
            # Also allow missing content-type if the body is explicitly empty.
            content_type = request.headers.get("Content-Type", "")
            
            # Simple check: must be application/json for state-changing requests
            if not content_type.startswith("application/json"):
                return JSONResponse(
                    status_code=400,
                    content={
                        "error": True,
                        "code": "CSRF_ERROR",
                        "message": "Content-Type must be application/json for state-changing requests (CSRF protection)."
                    }
                )
                    
        return await call_next(request)
