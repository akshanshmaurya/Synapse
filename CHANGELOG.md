# Changelog — Synapse

All notable changes to the Synapse project are documented here.

---

## [2.0.0] — 2026-03-03 — Phase 1: Engineering Hardening

### Overview

Upgraded the entire Synapse backend from MVP-level to production-grade engineering standards. **21 files modified, 5 new files created, zero business logic altered.** The agent architecture (Memory → Planner → Executor → Evaluator) remains completely untouched.

---

### 1️⃣ Centralized Configuration & Secret Management

**Problem**: Secrets were scattered across 6 files using `os.getenv()` with insecure fallback defaults. The JWT handler had a hardcoded fallback secret (`"gentle-guide-secret-key-change-in-production"`), and the MongoDB connector defaulted to `localhost:27017` if no env var was set.

**Implementation**:

- Created `backend/app/core/config.py` using `pydantic-settings` `BaseSettings` class
- All environment variables are now loaded from a single `backend/.env` file via pydantic's model config
- `JWT_SECRET` and `GEMINI_API_KEY` are **required** fields with no defaults — the app won't start without them
- Optional fields like `ELEVENLABS_API_KEY` default to empty string (graceful degradation)
- Exported a singleton `settings = Settings()` used across the entire codebase
- Created `backend/.env.example` as a template with no real secrets

**Files Changed**:

| File | Change |
|------|--------|
| `backend/app/core/__init__.py` | **[NEW]** Package init |
| `backend/app/core/config.py` | **[NEW]** `Settings(BaseSettings)` with all env vars |
| `backend/.env.example` | **[NEW]** Template with placeholder values |
| `backend/.env` | Updated variable names (`MONGODB_URL` → `MONGO_URI`, `JWT_SECRET_KEY` → `JWT_SECRET`) |
| `backend/requirements.txt` | Added `pydantic-settings>=2.0.0` |
| `backend/app/db/mongodb.py` | `os.getenv("MONGODB_URL")` → `settings.MONGO_URI` |
| `backend/app/auth/jwt_handler.py` | Removed hardcoded fallback, all 3 constants → `settings.*` |
| `backend/app/agents/memory_agent.py` | `os.getenv("GEMINI_API_KEY")` → `settings.GEMINI_API_KEY` |
| `backend/app/agents/planner_agent.py` | Same Gemini key migration |
| `backend/app/agents/executor_agent.py` | Same Gemini key migration |
| `backend/app/agents/evaluator_agent.py` | Same Gemini key migration |
| `backend/app/services/tts.py` | `os.getenv("ELEVENLABS_API_KEY")` → `settings.ELEVENLABS_API_KEY` |

**Verification**: `grep -r "os.getenv" backend/app/ --include="*.py"` returns **0 results**.

---

### 2️⃣ JWT Auth Migration — HttpOnly Cookie

**Problem**: JWT tokens were returned in the JSON response body, stored in `localStorage` on the frontend, and sent via `Authorization: Bearer <token>` headers. This made tokens accessible to any JavaScript running on the page (XSS vulnerability).

**Implementation**:

**Backend**:

- Login and signup endpoints now set the JWT as an `HttpOnly` cookie via `Response.set_cookie()`:

  ```python
  response.set_cookie(
      key="access_token",
      value=token,
      httponly=True,        # JavaScript cannot read this
      samesite="lax",       # CSRF protection
      secure=True/False,    # True in production (HTTPS only)
      max_age=...,          # From settings.ACCESS_TOKEN_EXPIRE_MINUTES
      path="/",
  )
  ```

- Created new `AuthResponse` model (replaces `TokenResponse`) — returns only `user` data, no token in body
- Auth dependency (`dependencies.py`) now extracts token from `request.cookies.get("access_token")` instead of `Authorization` header
- Added `POST /api/auth/logout` endpoint that clears the cookie with `response.delete_cookie()`

**Frontend**:

- `AuthContext.tsx`: Removed all `localStorage.setItem('auth_token')` and `localStorage.getItem('auth_token')`. Only non-sensitive user profile data stays in `localStorage('auth_user')` for UI hydration
- `api.ts`: Removed `getAuthHeaders()` helper function entirely. All 24 `fetch()` calls now include `credentials: 'include'` to automatically send cookies
- `OnboardingPage.tsx`: Removed 2 `Authorization` header injections, added `credentials: 'include'`
- `RoadmapPage.tsx`: Removed 4 `Authorization` header injections, added `credentials: 'include'`

**Files Changed**:

| File | Change |
|------|--------|
| `backend/app/routes/auth.py` | Cookie-based login/signup, new logout endpoint |
| `backend/app/auth/dependencies.py` | Token extraction from cookie |
| `backend/app/models/user.py` | `TokenResponse` → `AuthResponse` (no token in body) |
| `src/contexts/AuthContext.tsx` | Full rewrite — no localStorage token |
| `src/services/api.ts` | Full rewrite — `credentials: 'include'` everywhere |
| `src/pages/OnboardingPage.tsx` | Removed `Authorization` headers |
| `src/pages/RoadmapPage.tsx` | Removed `Authorization` headers |

**Verification**:

- `grep "Authorization" src/ -r` → **0 results**
- `grep "localStorage.*auth_token" src/ -r` → **0 results**

---

### 3️⃣ Password Hashing Enforcement

**Problem**: While `password.py` already implemented bcrypt hashing, there were no length constraints on passwords at the Pydantic model level, allowing empty or extremely long passwords.

**Implementation**:

- `password.py` was **already solid** — it uses a `SHA-256 → Base64 → bcrypt` pipeline that handles arbitrary-length passwords safely (avoids bcrypt's 72-byte limit)
- Added `min_length=8, max_length=128` constraints to `UserCreate.password` and `UserLogin.password` via Pydantic `Field()`
- Added `max_length=100` to `UserCreate.name`

**Files Changed**:

| File | Change |
|------|--------|
| `backend/app/models/user.py` | Added Field constraints to password and name |

**Note**: No changes to the hashing logic itself — it was already production-grade.

---

### 4️⃣ Role-Based Authorization (RBAC)

**Problem**: All authenticated users had the same permissions. No distinction between regular users and administrators.

**Implementation**:

- Added `role: str = "user"` field to user documents on signup
- Created `require_role(role: str)` dependency factory in `dependencies.py`:

  ```python
  def require_role(required_role: str):
      async def role_checker(current_user=Depends(get_current_user)):
          if current_user.get("role") != required_role:
              raise HTTPException(403, "Insufficient permissions")
          return current_user
      return role_checker
  ```

- Applied `require_role("admin")` to the `/api/traces` endpoint — only admin users can view system traces
- Regular users get a `403 Forbidden` response with "Insufficient permissions"
- Role mismatches are logged with `logger.warning(...)`

**Files Changed**:

| File | Change |
|------|--------|
| `backend/app/auth/dependencies.py` | `require_role()` dependency factory |
| `backend/app/auth/__init__.py` | Export `require_role` |
| `backend/app/routes/auth.py` | `role: "user"` added to signup user document |
| `backend/app/routes/trace.py` | Protected with `Depends(require_role("admin"))` |

---

### 5️⃣ Rate Limiting

**Problem**: No protection against brute-force login attempts, chat spam, or API abuse.

**Implementation**:

- Built a **custom in-memory rate limiter** (`backend/app/core/rate_limiter.py`) using sliding window counters
- The `RateLimiter` class tracks request timestamps per IP and cleans expired entries on each check
- Created `rate_limit(max_requests, window_seconds, prefix)` dependency factory for clean FastAPI integration:

  ```python
  @router.post("/login")
  async def login(
      ...,
      _rate=Depends(rate_limit(5, 60, "login")),
  ):
  ```

- Rate limits applied:
  - **Login**: 5 requests/minute per IP
  - **Chat**: 30 requests/minute per IP
  - **Guest chat**: 10 requests/minute per IP
- Exceeded requests return `429 Too Many Requests`

**Files Changed**:

| File | Change |
|------|--------|
| `backend/app/core/rate_limiter.py` | **[NEW]** Custom sliding window rate limiter |
| `backend/app/main.py` | Applied `rate_limit()` to chat endpoints |
| `backend/app/routes/auth.py` | Applied `rate_limit(5, 60)` to login |

**Challenge**: See [Challenges Section](#challenges-faced) — SlowAPI was originally planned but incompatible with Python 3.14.

---

### 6️⃣ CORS Restriction

**Problem**: CORS was set to `allow_origins=["*"]` (accept requests from ANY domain) with no credentials support.

**Implementation**:

- Replaced wildcard with `settings.CORS_ORIGINS` — a list loaded from the `.env` file
- Default dev origins: `["http://localhost:5173", "http://localhost:3000"]`
- Enabled `allow_credentials=True` (required for cookies to be sent cross-origin)
- Production origins can be configured via the `CORS_ORIGINS` env var as a JSON array

**Files Changed**:

| File | Change |
|------|--------|
| `backend/app/main.py` | `allow_origins=settings.CORS_ORIGINS`, `allow_credentials=True` |
| `backend/app/core/config.py` | `CORS_ORIGINS: List[str]` field |
| `backend/.env` | `CORS_ORIGINS=["http://localhost:5173","http://localhost:3000"]` |

**Important**: Wildcard `"*"` with `credentials: true` is **rejected by browsers** — this change was essential for the cookie migration.

---

### 7️⃣ Security Headers Middleware

**Problem**: No security headers were present on any response.

**Implementation**:

- Created `SecurityHeadersMiddleware` using Starlette's `BaseHTTPMiddleware`
- Headers added to every response:
  - `X-Content-Type-Options: nosniff` — prevents MIME-type sniffing
  - `X-Frame-Options: DENY` — prevents clickjacking via iframes
  - `X-XSS-Protection: 1; mode=block` — enables browser XSS filters
  - `Referrer-Policy: no-referrer` — prevents leaking referrer data
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains` — HSTS (production only)

**Files Changed**:

| File | Change |
|------|--------|
| `backend/app/core/middleware.py` | **[NEW]** `SecurityHeadersMiddleware` |
| `backend/app/main.py` | `app.add_middleware(SecurityHeadersMiddleware)` |

---

### 8️⃣ Input Validation Hardening

**Problem**: Several request models accepted raw strings with no length constraints or enum validation, potentially allowing injection or malformed payloads.

**Implementation**:

- Applied Pydantic `Field()` constraints across all request models:

| Model | Field | Constraint |
|-------|-------|-----------|
| `ChatRequest.message` | `min_length=1, max_length=5000` | No empty or oversized messages |
| `TTSRequest.text` | `min_length=1, max_length=2000` | TTS payload limit |
| `UserCreate.password` | `min_length=8, max_length=128` | Password strength baseline |
| `UserCreate.name` | `max_length=100` | Name length cap |
| `CreateChatRequest.title` | `max_length=200` | Chat title limit |
| `UpdateChatRequest.title` | `min_length=1, max_length=200` | No empty titles |
| `RoadmapGenerateRequest.goal` | `min_length=1, max_length=1000` | Goal description limit |
| `RoadmapGenerateRequest.context` | `max_length=2000` | Context limit |
| `StepFeedbackRequest.message` | `max_length=2000` | Feedback message limit |

- Applied `Literal` type validation to onboarding fields (enum-like enforcement):
  - `guidance_type`: `Literal["career", "skills", "goals", "confidence", "balance"]`
  - `experience_level`: `Literal["beginner", "intermediate", "advanced"]`
  - `mentoring_style`: `Literal["gentle", "supportive", "direct", "challenging"]`

**Files Changed**:

| File | Change |
|------|--------|
| `backend/app/main.py` | `ChatRequest`, `TTSRequest` with Field constraints |
| `backend/app/models/user.py` | Password and name constraints |
| `backend/app/routes/onboarding.py` | `Literal` types on 3 fields |
| `backend/app/routes/chat_history.py` | Title length constraints |
| `backend/app/models/roadmap.py` | Goal, context, message constraints |

---

### 9️⃣ Structured Logging System

**Problem**: The entire codebase used `print()` for debugging — 33+ print statements across 10 files. The existing `logger.py` was a thin wrapper that still called `print()` internally and wrote to a file.

**Implementation**:

- Rewrote `utils/logger.py` with Python's `logging` module:
  - Structured format: `2026-03-03 23:30:00 | INFO    | synapse.module | message`
  - Output to `stdout` (container-friendly, no file I/O)
  - Singleton pattern with `propagate = False` to prevent duplicate logs
- Replaced **every single `print()` call** across the backend with appropriate log levels:
  - `print("Connected to MongoDB")` → `logger.info("MongoDB connected: %s", db_name)`
  - `print(f"Error: {e}")` → `logger.error("Error: %s", e, exc_info=True)`
  - `print("Warning: key not set")` → `logger.warning("ELEVENLABS_API_KEY not set")`
- Removed all `import traceback` + `traceback.print_exc()` calls (replaced by `exc_info=True`)
- Removed a debug print that **logged email and password length** on signup (`print(f"Debug: Registering user {email}, password length: {len(password)}")`)

**Files Changed** (print → logger migration):

| File | `print()` calls removed |
|------|------------------------|
| `backend/app/utils/logger.py` | Rewritten entirely |
| `backend/app/main.py` | 6 |
| `backend/app/routes/auth.py` | 5 |
| `backend/app/db/mongodb.py` | 2 |
| `backend/app/services/agent_orchestrator.py` | 3 |
| `backend/app/services/tts.py` | 3 |
| `backend/app/services/llm_utils.py` | 2 |
| `backend/app/agents/planner_agent.py` | 3 |
| `backend/app/agents/memory_agent.py` | 1 |
| `backend/app/agents/executor_agent.py` | 4 |
| `backend/app/agents/evaluator_agent.py` | 2 |

**Verification**: `grep -r "print(" backend/app/ --include="*.py"` → **0 results**

---

### 🔟 Health Check Endpoint

**Problem**: No canonical health check endpoint for monitoring. An old `/api/auth/health` existed but was nested under auth routes and leaked user counts.

**Implementation**:

- Added `GET /health` at the root level in `main.py`
- Returns MongoDB connection status with an actual `ping` command:

  ```json
  {
    "status": "healthy",
    "database": "connected",
    "environment": "development"
  }
  ```

- Returns `"degraded"` status if MongoDB is disconnected or ping fails
- Removed the old `/api/auth/health` endpoint (which leaked `user_count` in the response)

**Files Changed**:

| File | Change |
|------|--------|
| `backend/app/main.py` | New `GET /health` endpoint with MongoDB ping |
| `backend/app/routes/auth.py` | Removed old `/api/auth/health` |

---

### 1️⃣1️⃣ CSRF Mitigation

**Problem**: With cookie-based auth, the app becomes vulnerable to CSRF (Cross-Site Request Forgery) attacks.

**Implementation**:
This was addressed through a combination of items 2 and 6:

- **SameSite=Lax** on the auth cookie — browsers won't send the cookie on cross-origin POST requests initiated by third-party sites
- **Strict CORS** — only requests from `settings.CORS_ORIGINS` are allowed; browsers block preflight requests from unauthorized origins
- **All state-changing endpoints require authentication** — already the case by design

No additional CSRF token mechanism was needed because `SameSite=Lax` + strict CORS provides sufficient protection for this application's threat model.

---

## Challenges Faced

### Challenge 1: Python 3.14 Compatibility — `pkg_resources` Removal

**Severity**: 🔴 Blocking — server would not start

**What happened**: The original plan used `SlowAPI` for rate limiting. SlowAPI depends on the `limits` library, which imports `pkg_resources` at module level:

```python
# limits/util.py
import pkg_resources  # ← ModuleNotFoundError on Python 3.14
```

`pkg_resources` was part of `setuptools` but was **deprecated and removed from Python 3.14's standard library**. Even installing `setuptools` into the venv didn't fix it because the newer versions of `setuptools` no longer bundle `pkg_resources`.

**How I discovered it**: After installing `slowapi` and running `python -m uvicorn app.main:app --reload`, the server crashed immediately with:

```
ModuleNotFoundError: No module named 'pkg_resources'
```

**Resolution**: Replaced `SlowAPI` with a **custom in-memory rate limiter** (`backend/app/core/rate_limiter.py`) that:

- Uses a sliding window counter pattern (pure Python `time.time()` + `defaultdict(list)`)
- Provides the same `rate_limit(max_requests, window_seconds)` interface as a FastAPI `Depends()` factory
- Has zero external dependencies
- Was tested and confirmed working on Python 3.14

**Trade-off**: The custom rate limiter is in-memory and per-process. In a multi-worker production setup, each worker has its own counter. For Synapse's scale, this is acceptable. If horizontal scaling becomes needed, the `RateLimiter` class can be swapped to use Redis as a backing store without changing the API.

---

### Challenge 2: Broken Virtual Environment — Stale Launcher Paths

**Severity**: 🟡 Moderate — required workaround

**What happened**: The project's `venv` was originally created at `C:\Major Projects\gentle-guide\backend\venv\` but the project was later moved to `C:\Projects\Major Projects\Synapse\`. The launcher scripts (`uvicorn.exe`, `pip.exe`) inside the venv have the original Python path hardcoded in their binary headers:

```
Fatal error in launcher: Unable to create process using
'"C:\Major Projects\gentle-guide\backend\venv\Scripts\python.exe"'
```

**Resolution**: Used `python -m <module>` instead of direct executables:

- `python -m uvicorn app.main:app --reload` instead of `uvicorn app.main:app --reload`
- `python -m pip install <package>` instead of `pip install <package>`
- For venv-specific installs: `& "venv\Scripts\python.exe" -m pip install <package>`

**Root cause**: The venv was never recreated after the directory move. A fresh `python -m venv venv` would permanently fix this, but that's outside the scope of this hardening.

---

### Challenge 3: CORS + Cookies — Wildcard Incompatibility

**Severity**: 🟡 Design constraint — required coordinated change

**What happened**: The existing CORS configuration used `allow_origins=["*"]`. When migrating to cookie-based auth, browsers enforce a strict rule:

> **CORS with `credentials: true` cannot use wildcard `"*"` as the allowed origin.**

This means the cookie migration (item 2) and CORS restriction (item 6) were **tightly coupled** — both had to be implemented together, and the allowed origins had to be explicitly listed.

**Resolution**: Made `CORS_ORIGINS` a configurable `List[str]` in the settings, defaulting to `["http://localhost:5173", "http://localhost:3000"]` for development. Production deployments set the actual frontend domain via the `.env` file.

---

### Challenge 4: Frontend Token Removal — Coordinating 4 Files

**Severity**: 🟢 Low — required careful scope tracking

**What happened**: The `token` from `useAuth()` was used in 4 different frontend files, each with slightly different patterns:

- `AuthContext.tsx`: Stored token and exposed it via context (11 `localStorage` references)
- `api.ts`: `getAuthHeaders()` function injecting `Authorization` headers into 24 fetch calls
- `OnboardingPage.tsx`: Direct `Authorization` header in 2 fetch calls
- `RoadmapPage.tsx`: Direct `Authorization` header in 4 fetch calls

Missing even one of these would have caused silent 401 errors in production.

**Resolution**: Used `grep_search` to find **every** `Authorization` and `localStorage.getItem('auth_token')` reference before making any changes, then systematically updated all 4 files. After completion, ran verification greps to confirm zero remaining references.

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Files created | 5 |
| Files modified | 21 |
| `os.getenv` calls removed | 8 |
| `print()` calls removed | 33+ |
| `Authorization` headers removed | 11 |
| `localStorage` token references removed | 11 |
| New endpoints added | 2 (`/health`, `/api/auth/logout`) |
| New middleware added | 1 (`SecurityHeadersMiddleware`) |
| New dependencies added | 1 (`pydantic-settings`) |
| Dependencies removed | 1 (`slowapi` — replaced with custom) |
| Business logic changed | 0 |
| Agent architecture changed | 0 |
