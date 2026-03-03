# Changelog — Synapse

All notable changes to the Synapse project are documented here.

---

## [2.1.0] — 2026-03-04 — Phase 1.5: Production Hardening

### Overview

Finalized the Phase 1.5 hardening of the Synapse backend to achieve a production-grade engineering standard. Added robust token management, proactive security blocking, graceful failures, and precise execution environments.

---

### 1️⃣ JWT Lifecycle Hardening (Access + Refresh Tokens)

**Problem**: The access token was valid for a long period, meaning compromised tokens could be exploited for an extended time. There was no mechanism to seamlessly rotate tokens without requiring user re-authentication.

**Implementation**:

- Reduced `ACCESS_TOKEN_EXPIRE_MINUTES` to 30 minutes.
- Introduced `refresh_token` with an expiration of 7 days.
- Issued both tokens securely via `HttpOnly` and `SameSite` cookies on login and signup.
- Stored the `refresh_token` (hashed via bcrypt) in a new MongoDB `sessions` collection.
- Created `POST /api/auth/refresh` endpoint to validate, rotate the refresh token in the DB, and issue new `access_token` and `refresh_token` cookies.
- Updated `POST /api/auth/logout` to clear both cookies and delete the session from the database.

**Files Changed**:

| File | Change |
|------|--------|
| `backend/app/auth/jwt_handler.py` | Added `token_type` claims and `create_refresh_token` |
| `backend/app/models/session.py` | **[NEW]** `SessionInDB` model |
| `backend/app/routes/auth.py` | Updated token issuance, added `/refresh`, modified `/logout` |
| `backend/app/core/config.py` | Added `REFRESH_TOKEN_EXPIRE_DAYS` |
| `backend/.env` | Updated `ACCESS_TOKEN_EXPIRE_MINUTES` |

---

### 2️⃣ Database Index Hardening

**Problem**: Queries were running without indexes, which degrades performance immensely as data scales (causing full collection scans).

**Implementation**:

- Implemented programmatic index creation asynchronously inside `mongodb.py` upon initial application connection.
- `users`: Unique index on `email`, normal index on `role`.
- `sessions`: Index on `user_id` and a **TTL index** on `expires_at` to automatically delete expired refresh tokens.
- `chats`: Compound index on `user_id` and `updated_at`.
- `messages`: Compound index on `chat_id` and `timestamp`, and index on `user_id`.
- `roadmaps`: Index on `user_id`.

**Files Changed**:

| File | Change |
|------|--------|
| `backend/app/db/mongodb.py` | Created `create_all_indexes` method and called on startup |

---

### 3️⃣ Account Lockout Mechanism (Brute-Force Protection)

**Problem**: Password brute-forcing was only hindered by generic IP rate-limiting, which didn't prevent distributed attacks against a specific account.

**Implementation**:

- Added `failed_attempts` (int) and `lock_until` (datetime) to the `UserInDB` model.
- Intercepted failed passwords in `/login`. Increment `failed_attempts`.
- On reaching 5 failed attempts, the account is locked for 15 minutes by setting `lock_until`.
- Success resets both fields.
- Attempting to log into a locked account returns a `403 Forbidden` response.

**Files Changed**:

| File | Change |
|------|--------|
| `backend/app/models/user.py` | Added fields to UserInDB |
| `backend/app/routes/auth.py` | Implemented brute-force checks and DB updates |

---

### 4️⃣ Content Security Policy (CSP) Header

**Problem**: XSS attacks were somewhat mitigated by `HttpOnly` cookies, but an explicit CSP provides a definitive wall against unauthorized scripts and connections.

**Implementation**:

- Enhanced `SecurityHeadersMiddleware` with a strict `Content-Security-Policy`.
- Restricted `connect-src` to exactly what the application needs: `'self'`, Google Gemini, and ElevenLabs APIs.
- Prevented unauthorized framing and inline script execution.

**Files Changed**:

| File | Change |
|------|--------|
| `backend/app/core/middleware.py` | Added `Content-Security-Policy` header |

---

### 5️⃣ Standardized Error Response System

**Problem**: FastAPI generates custom formatted errors (e.g., `detail` arrays for validation errors) which breaks frontend expectations. Exceptions raised internal `500` outputs that were unformatted.

**Implementation**:

- Integrated an overarching global exception handler inside `main.py`.
- Formatted `Exception`, `HTTPException`, and `RequestValidationError` into a uniform schema:
  `{"error": True, "code": "SCENARIO_CODE", "message": "human readable output"}`
- Derived standard HTTP codes to text codes (e.g. `BAD_REQUEST`, `UNAUTHORIZED`, `VALIDATION_ERROR`).
- Logged actual stack traces internally, while returning clean messages to the client.

**Files Changed**:

| File | Change |
|------|--------|
| `backend/app/main.py` | Added customized exception handlers |

---

### 6️⃣ Database Connection Resilience

**Problem**: If the backend started slightly before the database was ready (common in Docker Compose), it crashed explicitly.

**Implementation**:

- Altered the MongoDB motor setup inside `mongodb.py` to support asynchronous robustness.
- Implemented a max-retry 3-loop with a 2-second sleep delay.
- Enforced strict timeouts (`serverSelectionTimeoutMS: 5000`) to avoid indefinite hanging.
- Successfully hooked into FastAPI's `lifespan` architecture.

**Files Changed**:

| File | Change |
|------|--------|
| `backend/app/db/mongodb.py` | Added connection retries and ping verification |
| `backend/app/main.py` | Changed synchronous connection to `await MongoDB.connect()` |

---

### 7️⃣ Strict Dependency Pinning

**Problem**: The `requirements.txt` allowed floating versions (`>=`), which could break deployments if upstream packages introduced breaking changes.

**Implementation**:

- Performed a frozen pip export of the working environment.
- Replaced floating dependencies with exact, tested versions (e.g., `fastapi==0.128.0`, `motor==3.7.1`).

**Files Changed**:

| File | Change |
|------|--------|
| `backend/requirements.txt` | Pinned exact specific version values |

---

## Challenges Faced

### Challenge 1: Rate Limiter Shadowing Lockout Logic

**Severity**: 🟡 Moderate — Testing overlap

**What happened**: While testing the 5-attempt account lockout logic, the system returned a `429 Too Many Requests` rather than the `403 Forbidden` lockout response.
**Root Cause**: The global IP-based rate limiter (implemented in Phase 1) correctly enforces a maximum of 5 requests per 60 seconds on the login route. By definition, a brute force attack triggers the rate limiter immediately before the DB logic records the final strike.
**Resolution**: Temporarily relaxed the rate limit to 10/min during automated testing to confirm the database lockout mechanism fully enforced the 15-minute ban boundary exactly on the 6th attempt. In production, having the 429 acts as a highly efficient outer-defense shield, while the 403 provides an account-specific inner-defense shield.

### Challenge 2: Test Automation Rate Limitations

**Severity**: 🟢 Low — Required Script Adjustments

**What happened**: When executing the python-based local validation script `test_auth.py`, simultaneous requests were rejected immediately by the Phase 1 rate limiter.
**Resolution**: Implemented unique randomized email generation per test run and introduced asynchronous `sleep(2)` calls between endpoints to navigate successfully through our own defense mechanisms!
