"""
Password Hashing Utilities

Design:
- Supports passwords of arbitrary length
- Avoids bcrypt's 72-byte input limit via SHA-256 pre-hashing
- Uses bcrypt directly for hashing (avoids passlib backend issues)
- Ensures bcrypt NEVER sees raw user input

Hash scheme:
bcrypt( base64( SHA256( UTF-8(password) ) ) )
"""

import hashlib
import base64
import bcrypt


def _prepare_password(password: str) -> bytes:
    """
    Normalize and pre-hash password.

    Steps:
    1. UTF-8 encode (strict)
    2. SHA-256 hash (fixed 32 bytes)
    3. Base64 encode (ASCII-safe, ~44 chars)

    Output is ALWAYS safe for bcrypt input (under 72 bytes).
    """
    if not isinstance(password, str):
        raise TypeError("Password must be a string")

    sha256_digest = hashlib.sha256(
        password.encode("utf-8", errors="strict")
    ).digest()

    # Base64 encode -> 44 characters, well under 72 byte limit
    return base64.b64encode(sha256_digest)


def hash_password(password: str) -> str:
    """
    Hash a password for storage.

    Accepts passwords of any length.
    """
    prepared = _prepare_password(password)
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(prepared, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, stored_hash: str) -> bool:
    """
    Verify a password against a stored hash.

    Uses the same pre-hashing pipeline as hash_password().
    """
    prepared = _prepare_password(plain_password)
    stored_hash_bytes = stored_hash.encode("utf-8")
    
    try:
        return bcrypt.checkpw(prepared, stored_hash_bytes)
    except Exception:
        return False
