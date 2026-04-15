# Contributing to Synapse

Thank you for your interest in contributing to Synapse! This guide covers the conventions and processes you need to follow.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Branch Naming](#branch-naming)
- [Commit Message Format](#commit-message-format)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Architecture Overview](#architecture-overview)

---

## Getting Started

```bash
# Clone and install
git clone https://github.com/akshansh-maurya/Synapse.git
cd Synapse && npm install
cd backend && pip install -r requirements.txt -r requirements-dev.txt
```

Create your environment files:
- `backend/.env` — see [README.md](README.md#2-backend-setup) for required variables
- `.env` (project root) — set `VITE_API_URL=http://localhost:8000`

Verify the setup:
```bash
# Backend
cd backend && uvicorn app.main:app --reload --port 8000

# Frontend (from project root)
npm run dev
```

---

## Branch Naming

Use the following prefixes:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feat/` | New feature | `feat/interview-prep-mode` |
| `fix/` | Bug fix | `fix/clarity-score-overflow` |
| `docs/` | Documentation only | `docs/add-architecture-guide` |
| `refactor/` | Code refactor (no behavior change) | `refactor/extract-mastery-formula` |
| `test/` | Adding or updating tests | `test/concept-memory-edge-cases` |
| `chore/` | Tooling, CI, dependencies | `chore/upgrade-fastapi` |

Always branch from `main`. Keep branches short-lived.

---

## Commit Message Format

```
<type>(<scope>): <short description>

<optional body>
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`

**Scopes:** `agents`, `services`, `frontend`, `api`, `auth`, `db`, `ci`, `docs`

**Examples:**
```
feat(agents): add interview scoring to evaluator agent
fix(services): prevent clarity score from exceeding 100
docs(services): add docstrings to all public methods
test(agents): add edge cases for confusion fail-safe
refactor(frontend): extract concept map tooltip component
```

Keep the subject line under 72 characters. Use the body for "why", not "what".

---

## Code Standards

### Python (Backend)

- **Formatter:** [Ruff](https://docs.astral.sh/ruff/) (configured in `pyproject.toml`)
- **Type hints:** Required on all public function signatures
- **Docstrings:** Required on every public module, class, and function

**Docstring format (Google style):**
```python
"""One-sentence summary of what this function does.

Extended description if needed — explain the "why", not just the "what".

Args:
    user_id: The learner's unique identifier.
    session_id: The active session to analyze.

Returns:
    Dict with keys:
        - status: "success" or "error"
        - data: The computed result
"""
```

- No bare `except:` — always catch specific exceptions
- Use `logging` instead of `print()`
- Async functions should use `await` (not blocking I/O in async code)

### TypeScript (Frontend)

- **Linter:** ESLint (configured in `eslint.config.js`)
- **No `any` types** in production code — use explicit interfaces
- **JSDoc:** Required on all exported functions and hooks

**JSDoc format:**
```typescript
/**
 * One-sentence summary.
 *
 * @param chatId - The active chat session ID.
 * @returns The session context object or null.
 */
```

- Use named exports (not default exports)
- Prefer `interface` over `type` for object shapes
- Colocate types with their API function or hook

### General

- No hardcoded secrets, API keys, or URLs — use environment variables
- No `console.log` in production code — use proper logging
- Keep functions under 50 lines when possible
- Prefer early returns over deep nesting

---

## Testing

### Backend

```bash
cd backend

# Run all tests
pytest -q

# Run with coverage report
pytest --cov=app --cov-report=term-missing

# Run a specific test file
pytest tests/test_concept_memory_service.py -v

# Run tests matching a pattern
pytest -k "test_confusion" -v
```

**Test file naming:** `tests/test_<module_name>.py`

**Test function naming:** `test_<method>_<scenario>_<expected_result>`

```python
# Good
def test_classify_intent_casual_message_returns_casual():
    ...

# Bad
def test_intent():
    ...
```

**Coverage requirements:**
- New services/agents: aim for ≥ 80% line coverage
- Bug fixes: must include a regression test

### Frontend

```bash
# From project root
npm run test
```

---

## Pull Request Process

1. **Create a branch** from `main` using the [naming convention](#branch-naming)
2. **Make your changes** — follow the [code standards](#code-standards)
3. **Write/update tests** — CI will fail without passing tests
4. **Run linters locally:**
   ```bash
   # Backend
   cd backend && ruff check . && ruff format --check .

   # Frontend
   npx eslint .
   ```
5. **Open a PR** against `main` with:
   - A clear title following the commit format
   - Description of what changed and why
   - Screenshots for UI changes
6. **CI must pass** — ruff lint → pytest + coverage
7. **Address review feedback** promptly

---

## Architecture Overview

Synapse uses a four-agent pipeline (Memory → Planner → Executor → Evaluator) with three-layer memory (Identity, Concepts, Session). For a detailed breakdown, see [`docs/architecture.md`](docs/architecture.md).

**Key files for new contributors:**
- `backend/app/services/agent_orchestrator.py` — the pipeline coordinator
- `backend/app/agents/` — the four agent implementations
- `backend/app/services/` — memory layer services
- `src/services/api.ts` — frontend API client
- `src/hooks/` — React state management hooks

---

## Questions?

Open an issue or start a discussion. We're happy to help you find the right place to contribute.
