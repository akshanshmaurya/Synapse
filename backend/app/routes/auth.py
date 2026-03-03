"""
Authentication Routes
Login, Signup, and Logout endpoints with HttpOnly cookie-based JWT.
"""
from fastapi import APIRouter, HTTPException, status, Depends, Request
from fastapi.responses import JSONResponse
from datetime import datetime
from bson import ObjectId

from app.models.user import UserCreate, UserLogin, UserResponse, AuthResponse
from app.auth.password import hash_password, verify_password
from app.auth.jwt_handler import create_access_token
from app.db.mongodb import get_users_collection, get_user_memory_collection, MongoDB
from app.models.memory import UserMemory, Onboarding
from app.core.config import settings
from app.core.rate_limiter import rate_limit
from app.utils.logger import logger

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_auth_cookie(response: JSONResponse, token: str) -> JSONResponse:
    """Set the JWT as an HttpOnly cookie on the response."""
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    return response


@router.post("/signup")
async def signup(user_data: UserCreate):
    """Create a new user account. JWT set via HttpOnly cookie."""
    try:
        if MongoDB.db is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database connection not available",
            )

        users = get_users_collection()

        # Check if user already exists
        existing = await users.find_one({"email": user_data.email.lower()})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists",
            )

        # Create user document
        logger.info("Registering new user: %s", user_data.email)
        user_doc = {
            "email": user_data.email.lower(),
            "password_hash": hash_password(user_data.password),
            "name": user_data.name or user_data.email.split("@")[0],
            "role": "user",
            "created_at": datetime.utcnow(),
            "last_login": datetime.utcnow(),
        }

        result = await users.insert_one(user_doc)
        user_id = str(result.inserted_id)

        # Initialize user memory
        memory_collection = get_user_memory_collection()
        memory_doc = UserMemory(
            user_id=user_id,
            onboarding=Onboarding(),
        ).model_dump(exclude={"id"}, by_alias=False)
        await memory_collection.insert_one(memory_doc)

        # Create JWT token
        access_token = create_access_token(data={"sub": user_id})

        # Build response with cookie
        body = AuthResponse(
            user=UserResponse(
                id=user_id,
                email=user_doc["email"],
                name=user_doc["name"],
                created_at=user_doc["created_at"],
            )
        )
        response = JSONResponse(content=body.model_dump(mode="json"))
        return _set_auth_cookie(response, access_token)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Signup failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed. Please try again later.",
        )


@router.post("/login")
async def login(
    request: Request,
    credentials: UserLogin,
    _rate=Depends(rate_limit(5, 60, "login")),
):
    """Login with email and password. JWT set via HttpOnly cookie."""
    try:
        if MongoDB.db is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service unavailable",
            )

        users = get_users_collection()
        user = await users.find_one({"email": credentials.email.lower()})

        if not user:
            logger.warning("Login failed — email not found: %s", credentials.email)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Check your email or password and try again.",
            )

        if not verify_password(credentials.password, user["password_hash"]):
            logger.warning("Login failed — wrong password: %s", credentials.email)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Check your email or password and try again.",
            )

        # Update last login
        await users.update_one(
            {"_id": user["_id"]},
            {"$set": {"last_login": datetime.utcnow()}},
        )

        user_id = str(user["_id"])
        access_token = create_access_token(data={"sub": user_id})

        body = AuthResponse(
            user=UserResponse(
                id=user_id,
                email=user["email"],
                name=user.get("name"),
                created_at=user["created_at"],
            )
        )
        response = JSONResponse(content=body.model_dump(mode="json"))
        return _set_auth_cookie(response, access_token)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Login failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed. Please try again later.",
        )


@router.post("/logout")
async def logout():
    """Clear the auth cookie."""
    response = JSONResponse(content={"message": "Logged out"})
    response.delete_cookie(
        key="access_token",
        path="/",
        httponly=True,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
    )
    return response
