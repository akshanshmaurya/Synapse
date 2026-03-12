"""
JWT Token Tests — Synapse Backend
Covers: token creation, expiry, type claims, invalid rejection.
Pure unit tests — no DB required.
"""
import pytest
from datetime import timedelta
from app.auth.jwt_handler import create_access_token, create_refresh_token, verify_token, decode_token


class TestAccessTokenCreation:
    def test_creates_valid_token(self):
        """Access token is a non-empty string."""
        token = create_access_token({"sub": "user123"})
        assert isinstance(token, str)
        assert len(token) > 20

    def test_contains_access_type(self):
        """Access token payload includes token_type='access'."""
        token = create_access_token({"sub": "user123"})
        payload = verify_token(token)
        assert payload is not None
        assert payload.get("token_type") == "access"

    def test_contains_user_data(self):
        """Token preserves the subject claim."""
        token = create_access_token({"sub": "user_abc"})
        payload = verify_token(token)
        assert payload["sub"] == "user_abc"

    def test_custom_expiry(self):
        """Token accepts custom expiration delta."""
        token = create_access_token({"sub": "u1"}, expires_delta=timedelta(minutes=5))
        payload = verify_token(token)
        assert payload is not None
        assert "exp" in payload


class TestRefreshTokenCreation:
    def test_creates_valid_token(self):
        """Refresh token is a non-empty string."""
        token = create_refresh_token({"sub": "user123"})
        assert isinstance(token, str)
        assert len(token) > 20

    def test_contains_refresh_type(self):
        """Refresh token payload includes token_type='refresh'."""
        token = create_refresh_token({"sub": "user123"})
        payload = verify_token(token)
        assert payload is not None
        assert payload.get("token_type") == "refresh"

    def test_different_from_access(self):
        """Access and refresh tokens for same user are different strings."""
        access = create_access_token({"sub": "user123"})
        refresh = create_refresh_token({"sub": "user123"})
        assert access != refresh


class TestTokenTypeEnforcement:
    def test_access_has_access_type(self):
        """Access token claims are type='access'."""
        token = create_access_token({"sub": "u1"})
        payload = verify_token(token)
        assert payload["token_type"] == "access"

    def test_refresh_has_refresh_type(self):
        """Refresh token claims are type='refresh'."""
        token = create_refresh_token({"sub": "u1"})
        payload = verify_token(token)
        assert payload["token_type"] == "refresh"

    def test_types_are_different(self):
        """Access and refresh tokens have different type claims."""
        a = verify_token(create_access_token({"sub": "u1"}))
        r = verify_token(create_refresh_token({"sub": "u1"}))
        assert a["token_type"] != r["token_type"]


class TestTokenVerification:
    def test_valid_token_returns_payload(self):
        """Valid token passes verification."""
        token = create_access_token({"sub": "u1"})
        payload = verify_token(token)
        assert payload is not None
        assert payload["sub"] == "u1"

    def test_invalid_token_string(self):
        """Garbage string returns None."""
        payload = verify_token("not.a.valid.jwt")
        assert payload is None

    def test_expired_token(self):
        """Expired token returns None."""
        token = create_access_token({"sub": "u1"}, expires_delta=timedelta(seconds=-1))
        payload = verify_token(token)
        assert payload is None


class TestDecodeToken:
    def test_decode_returns_user_id(self):
        """decode_token returns the 'sub' claim."""
        token = create_access_token({"sub": "user_42"})
        result = decode_token(token)
        assert result == "user_42"

    def test_decode_invalid_returns_none(self):
        """decode_token returns None for invalid token."""
        result = decode_token("garbage")
        assert result is None
