"""
User Model for MongoDB
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime
from bson import ObjectId


class PyObjectId(str):
    """Custom type for MongoDB ObjectId"""
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, handler):
        if isinstance(v, ObjectId):
            return str(v)
        if isinstance(v, str) and ObjectId.is_valid(v):
            return v
        raise ValueError("Invalid ObjectId")


class UserCreate(BaseModel):
    """User creation request"""
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    name: Optional[str] = Field(None, max_length=100)


class UserLogin(BaseModel):
    """User login request"""
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class UserChangePassword(BaseModel):
    """User change password request"""
    old_password: str = Field(..., min_length=8, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)


class UserInDB(BaseModel):
    """User document in MongoDB"""
    id: Optional[str] = Field(None, alias="_id")
    email: str
    password_hash: str
    name: Optional[str] = None
    role: str = "user"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    failed_attempts: int = 0
    lock_until: Optional[datetime] = None

    class Config:
        populate_by_name = True


class UserResponse(BaseModel):
    """User response (safe, no password)"""
    id: str
    email: str
    name: Optional[str] = None
    created_at: datetime


class AuthResponse(BaseModel):
    """Auth response — token is set via HttpOnly cookie, NOT in this body"""
    user: UserResponse
