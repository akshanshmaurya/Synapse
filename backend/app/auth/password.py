"""
Password Hashing Utilities
Uses bcrypt for secure password hashing.
To bypass the 72-byte limit of bcrypt, we pre-hash the password with SHA-256.
"""
from passlib.context import CryptContext
import hashlib
import base64

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def _prepare_password(password: str) -> str:
    """
    Pre-hash password with SHA-256 and base64 encode it.
    This bypasses bcrypt's 72-character limit and avoids null-byte issues.
    """
    sha256_hash = hashlib.sha256(password.encode('utf-8')).digest()
    return base64.b64encode(sha256_hash).decode('utf-8')

def hash_password(password: str) -> str:
    """Hash a password using bcrypt (after SHA-256 pre-hashing)"""
    try:
        prepared = _prepare_password(password)
        return pwd_context.hash(prepared)
    except Exception as e:
        print(f"CRITICAL PASSWORD HASHING ERROR: {e}")
        raise e

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash (after SHA-256 pre-hashing)"""
    prepared = _prepare_password(plain_password)
    return pwd_context.verify(prepared, hashed_password)
