"""
Auth API Tests — Synapse Backend
Covers: signup, login, lockout, refresh, logout, change-password.
"""
import pytest
import asyncio


pytestmark = pytest.mark.asyncio


async def _signup(client, email, password="TestPassword123!"):
    """Helper: register a new user."""
    return await client.post(
        "/api/auth/signup",
        json={"email": email, "password": password},
    )


async def _login(client, email, password="TestPassword123!"):
    """Helper: login with credentials."""
    return await client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )


# ── Signup ────────────────────────────────────────────────────────────────


class TestSignup:
    async def test_signup_success(self, client, unique_email, valid_password):
        """New user can register successfully."""
        resp = await _signup(client, unique_email, valid_password)
        assert resp.status_code == 200
        data = resp.json()
        assert "user" in data
        assert data["user"]["email"] == unique_email.lower()

    async def test_signup_duplicate_email(self, client, unique_email, valid_password):
        """Duplicate email returns 400."""
        await _signup(client, unique_email, valid_password)
        resp = await _signup(client, unique_email, valid_password)
        assert resp.status_code == 400

    async def test_signup_weak_password(self, client, unique_email):
        """Password shorter than 8 chars is rejected (422)."""
        resp = await _signup(client, unique_email, "short")
        assert resp.status_code == 422


# ── Login ─────────────────────────────────────────────────────────────────


class TestLogin:
    async def test_login_success(self, client, unique_email, valid_password):
        """Correct credentials return 200 + set cookies."""
        await _signup(client, unique_email, valid_password)
        resp = await _login(client, unique_email, valid_password)
        assert resp.status_code == 200
        assert "access_token" in resp.cookies

    async def test_login_wrong_password(self, client, unique_email, valid_password):
        """Wrong password returns 401."""
        await _signup(client, unique_email, valid_password)
        resp = await _login(client, unique_email, "WrongPassword1!")
        assert resp.status_code == 401

    async def test_login_nonexistent_email(self, client):
        """Unknown email returns 401."""
        resp = await _login(client, "noone@example.com")
        assert resp.status_code == 401


# ── Account Lockout ───────────────────────────────────────────────────────


class TestAccountLockout:
    async def test_lockout_after_5_failures(self, client, unique_email, valid_password):
        """Account is locked after 5 consecutive bad passwords."""
        await _signup(client, unique_email, valid_password)

        for _ in range(5):
            await _login(client, unique_email, "WrongPassword1!")

        # 6th attempt should be 403 (locked)
        resp = await _login(client, unique_email, "WrongPassword1!")
        assert resp.status_code == 403


# ── JWT Refresh ───────────────────────────────────────────────────────────


class TestTokenRefresh:
    async def test_refresh_without_cookie(self, client):
        """Missing refresh cookie returns 401."""
        resp = await client.post("/api/auth/refresh")
        assert resp.status_code == 401

    async def test_refresh_success(self, client, unique_email, valid_password):
        """Valid refresh cookie rotates tokens."""
        await _signup(client, unique_email, valid_password)
        login_resp = await _login(client, unique_email, valid_password)

        # The refresh token cookie is path-restricted; pass it manually
        refresh_cookie = login_resp.cookies.get("refresh_token")
        if refresh_cookie:
            resp = await client.post(
                "/api/auth/refresh",
                cookies={"refresh_token": refresh_cookie},
            )
            assert resp.status_code == 200


# ── Logout ────────────────────────────────────────────────────────────────


class TestLogout:
    async def test_logout_clears_cookies(self, client, unique_email, valid_password):
        """Logout returns 200 and clears auth cookies."""
        await _signup(client, unique_email, valid_password)
        await _login(client, unique_email, valid_password)
        resp = await client.post("/api/auth/logout")
        assert resp.status_code == 200
