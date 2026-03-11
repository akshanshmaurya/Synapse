# Security Policy — Synapse

This document describes the security architecture implemented in the Synapse backend.

---

## Security Overview

Synapse implements a **defense-in-depth** security model across authentication, authorization, input validation, rate limiting, and transport security. All security features are production-grade and have been verified through Phase 1 (Engineering Hardening) and Phase 1.5 (Production Hardening).

---

## Authentication

### JWT Access + Refresh Token System

| Property | Value |
|----------|-------|
| Access token lifetime | 30 minutes |
| Refresh token lifetime | 7 days |
| Token storage | HttpOnly, SameSite=Lax cookies |
| Refresh token DB storage | bcrypt-hashed in `sessions` collection |
| Token rotation | On every refresh, old token deleted, new issued |
| Replay detection | Reused refresh token → all user sessions revoked |
| Session invalidation | Password change revokes all sessions |

**Files**: `backend/app/auth/jwt_handler.py`, `backend/app/routes/auth.py`

### Cookie Configuration

```
httponly=True       # JavaScript cannot access
samesite="lax"      # CSRF protection
secure=True         # HTTPS only (production)
```

---

## Password Security

**Pipeline**: `bcrypt(base64(SHA256(utf8(password))))`

This avoids bcrypt's 72-byte truncation vulnerability by pre-hashing with SHA256.

- Passwords constrained: `min_length=8, max_length=128` (Pydantic validation)
- Unique salt per hash via `bcrypt.gensalt()`
- No raw passwords are ever logged or returned in responses

**Files**: `backend/app/auth/password.py`, `backend/app/models/user.py`

---

## Authorization (RBAC)

Role-based access control is implemented via FastAPI dependency injection.

```python
# Usage pattern
@router.get("/admin-endpoint")
async def admin_only(user=Depends(require_role("admin"))):
    ...
```

- Users are assigned `role: "user"` on signup
- `require_role()` factory in `backend/app/auth/dependencies.py`
- Protected endpoint: `GET /api/traces` (admin only)
- Role mismatches return `403 Forbidden`

---

## Rate Limiting

Custom in-memory sliding window rate limiter.

| Endpoint | Limit |
|----------|-------|
| `POST /api/auth/login` | 5 requests/minute per IP |
| `POST /api/chat` | 30 requests/minute per IP |
| `POST /api/chat/guest` | 10 requests/minute per IP |

Exceeded requests return `429 Too Many Requests`.

> **Scalability**: The current implementation is per-process. For multi-worker deployments, replace with Redis-backed store. The `rate_limit()` API remains unchanged.

**File**: `backend/app/core/rate_limiter.py`

---

## Account Lockout Protection

- After **5 consecutive failed login attempts**, the account is locked for **15 minutes**
- Lockout state stored in user document (`failed_attempts`, `lock_until`)
- Successful login resets both counters
- Locked accounts receive `403 Forbidden`

**File**: `backend/app/routes/auth.py`

---

## Content Security Policy (CSP)

Applied via `SecurityHeadersMiddleware` on all responses:

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
connect-src 'self' https://generativelanguage.googleapis.com https://api.elevenlabs.io;
img-src 'self' data: https://fastapi.tiangolo.com;
frame-ancestors 'none';
```

**File**: `backend/app/core/middleware.py`

---

## Security Headers

Every response includes:

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `no-referrer` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` (production only) |
| `Content-Security-Policy` | See above |

---

## CORS Policy

- Explicit origin allowlist loaded from `CORS_ORIGINS` environment variable
- `allow_credentials=True` (required for cookie-based auth)
- Wildcard `"*"` is **never** used
- Production origins configured via `.env`

**File**: `backend/app/main.py`

---

## CSRF Mitigation

CSRF is mitigated through an architectural defense:

1. **SameSite=Lax** cookies — browsers block cross-origin POST cookie transmission
2. **Strict CORS** — only listed origins can make credentialed requests
3. **No token in response body** — cookies are the sole auth transport

No additional CSRF tokens are needed for this threat model.

---

## Input Validation

All request payloads are validated via Pydantic `BaseModel` with `Field()` constraints:

- Passwords: `min_length=8, max_length=128`
- Chat messages: `min_length=1, max_length=5000`
- TTS text: `min_length=1, max_length=2000`
- Onboarding fields: `Literal` type enforcement (enum-like)
- Roadmap goals: `min_length=1, max_length=1000`

**Files**: `backend/app/models/user.py`, `backend/app/main.py`, `backend/app/routes/onboarding.py`, `backend/app/models/roadmap.py`

---

## MongoDB Injection Safety

- The project uses MongoDB via Motor (async driver) with native BSON document API
- No SQL is used anywhere in the codebase
- No raw string query construction exists
- All user inputs pass through Pydantic validation before reaching the database layer

---

## Secret Management

- All secrets are loaded from environment variables via `pydantic-settings` (`BaseSettings`)
- `JWT_SECRET` and `GEMINI_API_KEY` have **no defaults** — the app crashes if unset
- A `.env.example` template is provided with placeholder values
- `.env` is listed in `.gitignore` and is not tracked by git
- No `os.getenv()` calls exist in the application code

**File**: `backend/app/core/config.py`

---

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it privately. Do not create public issues for security vulnerabilities.
