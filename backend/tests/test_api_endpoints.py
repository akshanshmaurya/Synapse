"""
API Endpoint Tests — Synapse Backend
Verifies auth-required endpoints reject unauthenticated requests
and error responses follow the standardized format.
"""
import pytest


pytestmark = pytest.mark.asyncio


class TestUnauthenticatedAccess:
    """Endpoints requiring auth must reject requests without cookies."""

    async def test_onboarding_status_requires_auth(self, client):
        resp = await client.get("/api/onboarding/status")
        assert resp.status_code == 401

    async def test_chat_history_requires_auth(self, client):
        resp = await client.get("/api/chats")
        # Should fail without auth (strictly 401)
        assert resp.status_code == 401

    async def test_roadmap_requires_auth(self, client):
        resp = await client.post(
            "/api/roadmap/generate",
            json={"goal": "learn python"},
        )
        assert resp.status_code == 401

    async def test_traces_require_admin(self, client):
        resp = await client.get("/api/traces/")
        assert resp.status_code in (401, 403) # Traces typically yield 403 if restricted, or 401 if unauthenticated. We leave this as is since it tests admin scope.


class TestPublicEndpoints:
    """Endpoints that should work without auth."""

    async def test_health_check(self, client):
        resp = await client.get("/health")
        assert resp.status_code == 200

    async def test_onboarding_questions(self, client):
        resp = await client.get("/api/onboarding/questions")
        assert resp.status_code == 200
        data = resp.json()
        assert "questions" in data
        assert len(data["questions"]) > 0


class TestSignupValidation:
    """Input validation on signup endpoint."""

    async def test_missing_email(self, client):
        resp = await client.post(
            "/api/auth/signup",
            json={"password": "ValidPass123!"},
        )
        assert resp.status_code == 422

    async def test_missing_password(self, client):
        resp = await client.post(
            "/api/auth/signup",
            json={"email": "test@example.com"},
        )
        assert resp.status_code == 422

    async def test_invalid_email_format(self, client):
        resp = await client.post(
            "/api/auth/signup",
            json={"email": "not-an-email", "password": "ValidPass123!"},
        )
        assert resp.status_code == 422

    async def test_short_password(self, client):
        resp = await client.post(
            "/api/auth/signup",
            json={"email": "test@example.com", "password": "short"},
        )
        assert resp.status_code == 422
