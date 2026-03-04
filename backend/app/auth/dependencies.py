"""
FastAPI Dependencies for Authentication & Authorization
- Cookie-based JWT extraction (HttpOnly cookie)
- Role-based access control (RBAC)
"""
from fastapi import Depends, HTTPException, Request, status
from typing import Optional
from app.auth.jwt_handler import decode_token
from app.db.mongodb import get_users_collection
from app.utils.logger import logger
from bson import ObjectId


async def get_current_user(request: Request):
    """
    Dependency to get the current authenticated user.
    Extracts JWT from HttpOnly cookie 'access_token'.
    Returns user document or raises 401.
    """
    token = request.cookies.get("access_token")

    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    user_id = decode_token(token)

    if user_id is None:
        logger.warning("Invalid or expired token presented")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    # Get user from database
    users = get_users_collection()
    user = await users.find_one({"_id": ObjectId(user_id)})

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


async def get_current_user_optional(request: Request):
    """
    Optional auth dependency. Returns user or None.
    Use for routes that work with or without auth.
    """
    token = request.cookies.get("access_token")
    if token is None:
        return None

    try:
        user_id = decode_token(token)
        if user_id is None:
            return None
        users = get_users_collection()
        return await users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        return None


def require_role(required_role: str):
    """
    Dependency factory for role-based access control.
    Usage: Depends(require_role("admin"))
    """
    async def role_checker(current_user: dict = Depends(get_current_user)):
        user_role = current_user.get("role", "user")
        if user_role != required_role:
            logger.warning(
                "Role check failed: user %s has role '%s', required '%s'",
                str(current_user["_id"]),
                user_role,
                required_role,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return role_checker
