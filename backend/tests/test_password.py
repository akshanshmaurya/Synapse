"""
Password Hashing Tests — Synapse Backend
Verifies the SHA256 → Base64 → bcrypt pipeline.
"""
import pytest
from app.auth.password import hash_password, verify_password


class TestHashPassword:
    def test_hash_returns_string(self):
        """hash_password returns a bcrypt string."""
        result = hash_password("TestPassword123!")
        assert isinstance(result, str)
        assert result.startswith("$2b$")

    def test_hash_is_unique_per_call(self):
        """Two hashes of the same password differ (unique salts)."""
        h1 = hash_password("SamePassword1!")
        h2 = hash_password("SamePassword1!")
        assert h1 != h2

    def test_hash_handles_long_password(self):
        """Passwords exceeding bcrypt's 72-byte limit still hash correctly."""
        long_pw = "A" * 200
        hashed = hash_password(long_pw)
        assert verify_password(long_pw, hashed)


class TestVerifyPassword:
    def test_correct_password(self):
        """Correct password verifies True."""
        hashed = hash_password("CorrectHorse1!")
        assert verify_password("CorrectHorse1!", hashed) is True

    def test_wrong_password(self):
        """Wrong password verifies False."""
        hashed = hash_password("CorrectHorse1!")
        assert verify_password("WrongHorse123!", hashed) is False

    def test_empty_hash(self):
        """Malformed hash returns False, doesn't crash."""
        assert verify_password("anything", "not_a_hash") is False

    def test_password_type_enforcement(self):
        """Non-string password raises TypeError."""
        with pytest.raises(TypeError):
            hash_password(12345)
