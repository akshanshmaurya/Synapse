"""
Password Hashing Utilities

Design:
- Supports passwords of arbitrary length
- Avoids bcrypt's 72-byte input limit via SHA-256 pre-hashing
- Uses passlib for safe salt handling and verification
- Ensures bcrypt NEVER sees raw user input

Hash scheme:
bcrypt( base64( SHA256( UTF-8(password) ) ) )
"""

from passlib.context import CryptContext
import hashlib
import base64

# CryptContext allows future algorithm upgrades without breaking hashes
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)

def _prepare_password(password: str) -> str:
    """
    Normalize and pre-hash password.

    Steps:
    1. UTF-8 encode (strict)
    2. SHA-256 hash (fixed 32 bytes)
    3. Base64 encode (ASCII-safe, ~44 chars)

    Output is ALWAYS safe for bcrypt input.
    """
    if not isinstance(password, str):
        raise TypeError("Password must be a string")

    sha256_digest = hashlib.sha256(
        password.encode("utf-8", errors="strict")
    ).digest()

    return base64.b64encode(sha256_digest).decode("ascii")

def hash_password(password: str) -> str:
    """
    Hash a password for storage.

    Accepts passwords of any length.
    """
    prepared = _prepare_password(password)
    return pwd_context.hash(prepared)

def verify_password(plain_password: str, stored_hash: str) -> bool:
    """
    Verify a password against a stored hash.

    Uses the same pre-hashing pipeline as hash_password().
    """
    prepared = _prepare_password(plain_password)
    return pwd_context.verify(prepared, stored_hash)
