"""
Error Handling Tests — Synapse Backend
Verifies standardized error responses across the API.
"""
import pytest


pytestmark = pytest.mark.asyncio


class TestValidationErrors:
    """Invalid payloads should return 422 with structured error."""

    async def test_signup_missing_fields(self, client):
        resp = await client.post("/api/auth/signup", json={})
        assert resp.status_code == 422
        data = resp.json()
        # App uses custom error format: {error, code, message}
        assert data.get("error") is True or "detail" in data

    async def test_signup_invalid_email(self, client):
        resp = await client.post(
            "/api/auth/signup",
            json={"email": "bad", "password": "ValidPass123!"},
        )
        assert resp.status_code == 422

    async def test_login_empty_body(self, client):
        resp = await client.post("/api/auth/login", json={})
        assert resp.status_code == 422

    async def test_login_missing_password(self, client):
        resp = await client.post(
            "/api/auth/login",
            json={"email": "test@example.com"},
        )
        assert resp.status_code == 422


class TestAuthErrors:
    """Auth endpoints return proper error codes."""

    async def test_refresh_without_cookie(self, client):
        """Refresh without cookie → 401."""
        resp = await client.post("/api/auth/refresh")
        assert resp.status_code == 401

    async def test_protected_endpoint_without_auth(self, client):
        """Protected endpoint without auth → 401 or 403."""
        resp = await client.get("/api/onboarding/status")
        assert resp.status_code in (401, 403)


class TestRateLimitErrors:
    """Rate limiter returns 429 with message."""

    async def test_login_rate_limit_response(self, client):
        """Exceeding login rate limit returns 429 with detail."""
        for _ in range(6):
            await client.post(
                "/api/auth/login",
                json={"email": "rate@test.com", "password": "WrongPass123!"},
            )

        resp = await client.post(
            "/api/auth/login",
            json={"email": "rate@test.com", "password": "WrongPass123!"},
        )
        assert resp.status_code == 429
        data = resp.json()
        # App uses custom error format: {error, code, message}
        assert data.get("error") is True or "detail" in data


class TestNotFoundErrors:
    """Unknown routes return proper errors."""

    async def test_unknown_route(self, client):
        resp = await client.get("/api/nonexistent")
        assert resp.status_code in (404, 405)
