# Synapse — Test Suite Documentation

## Overview

The Synapse backend has **169 automated tests** across **18 test files** (159 passing, 10 skipped).
All tests run in under 4 minutes with zero real API calls — all LLM and database operations are mocked.

**Coverage:** 52% line coverage across 3,563 statements (46 source modules).

---

## Running Tests

```bash
cd backend

# Quick run (all tests)
pytest -q

# With coverage report
pytest --cov=app --cov-report=term-missing

# Specific test suites
pytest tests/test_agents_pipeline.py -v          # Agent pipeline
pytest tests/test_session_context_service.py -v   # Session context
pytest tests/test_concept_memory_service.py -v    # Concept memory
pytest tests/test_evaluator_logic.py -v           # Evaluator logic
pytest tests/test_intent_goal_services.py -v      # Intent + Goal

# Run a single test by name
pytest -k "test_confusion_markers" -v
```

---

## Coverage Report

Current coverage: **52%** (3,563 statements, 1,718 missed)

### High Coverage Modules (≥ 80%)

| Module | Coverage | Notes |
|--------|----------|-------|
| `auth/password.py` | 100% | bcrypt + SHA-256 hashing |
| `auth/jwt_handler.py` | 97% | Token encode/decode |
| `core/authorization.py` | 100% | RBAC dependencies |
| `core/cors.py` | 100% | CORS configuration |
| `core/middleware.py` | 100% | Security headers |
| `core/config.py` | 91% | Environment settings |
| `core/csrf.py` | 90% | CSRF protection |
| `core/rate_limiter.py` | 97% | Rate limiting |
| `core/security_headers.py` | 90% | Header definitions |
| `models/chat.py` | 100% | Chat Pydantic models |
| `models/memory.py` | 100% | Memory Pydantic models |
| `models/memory_v2.py` | 94% | Three-layer memory models |
| `models/roadmap.py` | 100% | Roadmap Pydantic models |
| `models/session.py` | 100% | Session Pydantic models |
| `services/session_context_service.py` | 92% | Layer 3 working memory |
| `services/profile_service.py` | 92% | Layer 1 identity memory |
| `services/intent_classifier_service.py` | 80% | Intent classification |
| `services/goal_inference_service.py` | 80% | Goal inference |
| `routes/trace.py` | 88% | Trace endpoint |
| `utils/logger.py` | 93% | Structured logging |

### Medium Coverage Modules (40–79%)

| Module | Coverage | Notes |
|--------|----------|-------|
| `services/agent_orchestrator.py` | 73% | Pipeline coordinator |
| `routes/analytics.py` | 74% | Learning analytics |
| `routes/ws_chat.py` | 72% | WebSocket chat |
| `services/concept_memory_service.py` | 66% | Layer 2 concept memory |
| `agents/memory_agent.py` | 45% | Memory assembly |
| `agents/evaluator_agent.py` | 43% | Post-response analysis |
| `routes/chat_history.py` | 42% | Chat CRUD |
| `routes/onboarding.py` | 48% | Onboarding flow |
| `utils/sanitizer.py` | 44% | XSS prevention |

---

## Test File Reference

| Test File | Tests | What It Tests |
|-----------|-------|---------------|
| `test_agents_pipeline.py` | 15 | Full 4-agent pipeline: Memory → Planner → Executor → Evaluator chain |
| `test_analytics.py` | 8 | Learning analytics aggregation, clarity trends, session activity |
| `test_api_endpoints.py` | 10 | REST API endpoint validation, request/response schemas |
| `test_auth.py` | 10 | Registration, login, logout, token refresh, account lockout |
| `test_chat_history_routes.py` | 2 | Chat session CRUD operations |
| `test_concept_memory_service.py` | 18 | Concept mastery formula, exposure tracking, weak concept detection |
| `test_errors.py` | 8 | Error handling, exception propagation, graceful degradation |
| `test_evaluator_logic.py` | 7 | Confusion fail-safe, clarity scoring, intent guards |
| `test_evaluator_memory.py` | 10 | Evaluator ↔ memory integration, concept extraction, mastery updates |
| `test_intent_goal_services.py` | 8 | Intent classification (4 types), goal inference at message 3 |
| `test_jwt.py` | 15 | JWT encode/decode, expiration, invalid tokens, refresh flow |
| `test_memory_agent_v2.py` | 7 | Three-layer memory assembly, context packaging |
| `test_orchestrator_v2.py` | 8 | Orchestrator coordination, step sequencing, error recovery |
| `test_password.py` | 7 | bcrypt(SHA-256) hashing, verification, edge cases |
| `test_profile_service.py` | 7 | User profile CRUD, onboarding mapping, strength/weakness updates |
| `test_rate_limiter.py` | 5 | Rate limiting windows, key isolation, expiration |
| `test_session_context_service.py` | 18 | Session CRUD, momentum state machine, goal locking, concept dedup |
| `test_websocket.py` | 6 | WebSocket connection, streaming, token chunking |

---

## Testing Philosophy

- **Zero external API calls** — All Gemini LLM calls are mocked via `unittest.mock.AsyncMock`
- **Zero database dependency** — All MongoDB operations are mocked; tests run without a connection
- **Confusion fail-safe tested** — Adversarial LLM responses verified against hardcoded invariants
- **Intent classification tested** — All 4 intent types (`learning`, `casual`, `problem_solving`, `review`)
- **Goal inference tested** — All `should_infer` conditions (message count, intent type, confirmation state)
- **Momentum state machine tested** — All transitions: `cold_start → warming_up → flowing → stuck`
- **Mastery formula tested** — Weighted formula `0.6×clarity + 0.3×exposure + 0.1×recency` validated
- **Authentication tested** — Full JWT lifecycle, bcrypt hashing, account lockout, token refresh

---

## CI/CD Integration

Tests run automatically via GitHub Actions on every push to `main` or `dev` and on pull requests to `main`.

Pipeline: **ruff lint** → **pytest + coverage** (see `.github/workflows/ci.yml`)

Coverage threshold: 30% (enforced by `pytest-cov`). Current coverage: 52%.
