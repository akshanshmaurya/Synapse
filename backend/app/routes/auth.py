"""
Authentication Routes
Login, Signup, and Logout endpoints with HttpOnly cookie-based JWT.
"""
from fastapi import APIRouter, HTTPException, status, Depends, Request
from fastapi.responses import JSONResponse
from datetime import datetime, timedelta
from bson import ObjectId

from app.models.user import UserCreate, UserLogin, UserResponse, AuthResponse, UserChangePassword
from app.models.session import SessionInDB
from app.auth.password import hash_password, verify_password
from app.auth.jwt_handler import create_access_token, create_refresh_token, verify_token
from app.auth.dependencies import get_current_user
from app.db.mongodb import get_users_collection, get_user_memory_collection, get_sessions_collection, MongoDB
from app.models.memory import UserMemory, Onboarding
from app.core.config import settings
from app.core.rate_limiter import rate_limit
from app.utils.logger import logger

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_auth_cookies(response: JSONResponse, access_token: str, refresh_token: str = None) -> JSONResponse:
    """Set the JWT logic as HttpOnly cookies on the response."""
    production = settings.ENVIRONMENT == "production"
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=production,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    
    if refresh_token:
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            samesite="lax",
            secure=production,
            max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
            path="/api/auth/refresh",  # Only sent to refresh and logout
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
        logger.info("LOGIN_SUCCESS: Registering new user: %s", user_data.email)
        user_doc = {
            "email": user_data.email.lower(),
            "password_hash": hash_password(user_data.password),
            "name": user_data.name or user_data.email.split("@")[0],
            "role": "user",
            "created_at": datetime.utcnow(),
            "last_login": datetime.utcnow(),
            "failed_attempts": 0,
            "lock_until": None,
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
        refresh_token = create_refresh_token(data={"sub": user_id})
        
        # Hash and store session
        sessions = get_sessions_collection()
        session_doc = SessionInDB(
            user_id=user_id,
            hashed_token=hash_password(refresh_token),
            expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        )
        await sessions.insert_one(session_doc.model_dump())

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
        return _set_auth_cookies(response, access_token, refresh_token)

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
            logger.warning("LOGIN_FAILED: Login failed — email not found: %s", credentials.email)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Check your email or password and try again.",
            )

        # Lockout Check
        now = datetime.utcnow()
        if user.get("lock_until") and user["lock_until"] > now:
            logger.warning("LOGIN_FAILED: Login failed — account locked: %s", credentials.email)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account temporarily locked due to too many failed attempts. Try again later.",
            )

        # Verify Password
        if not verify_password(credentials.password, user["password_hash"]):
            failed_attempts = user.get("failed_attempts", 0) + 1
            update_data = {"failed_attempts": failed_attempts}
            
            if failed_attempts >= 5:
                update_data["lock_until"] = now + timedelta(minutes=15)
                logger.warning("ACCOUNT_LOCKED: Account locked for user %s after 5 failed attempts", credentials.email)
                
            await users.update_one({"_id": user["_id"]}, {"$set": update_data})
                
            logger.warning("LOGIN_FAILED: Login failed — wrong password: %s", credentials.email)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Check your email or password and try again.",
            )

        # Update last login and reset lockout
        await users.update_one(
            {"_id": user["_id"]},
            {"$set": {
                "last_login": datetime.utcnow(),
                "failed_attempts": 0,
                "lock_until": None,
            }, "$unset": {"lock_until": ""}},
        )

        user_id = str(user["_id"])
        access_token = create_access_token(data={"sub": user_id})
        refresh_token = create_refresh_token(data={"sub": user_id})
        
        logger.info("LOGIN_SUCCESS: User logged in: %s", credentials.email)
        
        # Store refresh token in DB
        sessions = get_sessions_collection()
        session_doc = SessionInDB(
            user_id=user_id,
            hashed_token=hash_password(refresh_token),
            expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        )
        await sessions.insert_one(session_doc.model_dump())

        body = AuthResponse(
            user=UserResponse(
                id=user_id,
                email=user["email"],
                name=user.get("name"),
                created_at=user["created_at"],
            )
        )
        response = JSONResponse(content=body.model_dump(mode="json"))
        return _set_auth_cookies(response, access_token, refresh_token)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Login failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed. Please try again later.",
        )


@router.post("/refresh")
async def refresh_token(request: Request):
    """Issue a new access token and rotate the refresh token."""
    refresh_token_cookie = request.cookies.get("refresh_token")
    if not refresh_token_cookie:
        raise HTTPException(status_code=401, detail="Refresh token missing")
        
    payload = verify_token(refresh_token_cookie)
    if not payload or payload.get("token_type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
        
    user_id = payload.get("sub")
    sessions = get_sessions_collection()
    
    # Verify hash is in DB (Find any session for this user where hash matches)
    user_sessions = await sessions.find({"user_id": user_id}).to_list(length=100)
    
    valid_session = None
    for session in user_sessions:
        if verify_password(refresh_token_cookie, session["hashed_token"]):
            valid_session = session
            break
            
    if not valid_session:
        # Detected token reuse or invalidated token! We could delete all sessions here for security.
        logger.warning("TOKEN_REVOKED: Refresh token reused or invalidated for user: %s", user_id)
        await sessions.delete_many({"user_id": user_id})
        raise HTTPException(status_code=401, detail="Session expired or invalid")
        
    # Rotate token
    await sessions.delete_one({"_id": valid_session["_id"]})
    
    new_access_token = create_access_token(data={"sub": user_id})
    new_refresh_token = create_refresh_token(data={"sub": user_id})
    
    new_session_doc = SessionInDB(
        user_id=user_id,
        hashed_token=hash_password(new_refresh_token),
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    await sessions.insert_one(new_session_doc.model_dump())
    
    logger.info("TOKEN_REFRESHED: Token rotated for user: %s", user_id)
    response = JSONResponse(content={"message": "Token refreshed"})
    return _set_auth_cookies(response, new_access_token, new_refresh_token)


@router.post("/logout")
async def logout(request: Request):
    """Clear the auth cookie and remove session from DB."""
    refresh_token_cookie = request.cookies.get("refresh_token")
    
    if refresh_token_cookie:
        payload = verify_token(refresh_token_cookie)
        if payload:
            user_id = payload.get("sub")
            sessions = get_sessions_collection()
            # In a production system, we'd verify the hash, but for logout, 
            # we can just delete all matching sessions or iterate. For simplicity/security,
            # clear the exact one.
            user_sessions = await sessions.find({"user_id": user_id}).to_list(length=100)
            for session in user_sessions:
                if verify_password(refresh_token_cookie, session["hashed_token"]):
                    await sessions.delete_one({"_id": session["_id"]})
                    break
            logger.info("TOKEN_REVOKED: User logged out, session cleared for user: %s", user_id)

    production = settings.ENVIRONMENT == "production"
    response = JSONResponse(content={"message": "Logged out"})
    
    response.delete_cookie(
        key="access_token",
        path="/",
        httponly=True,
        samesite="lax",
        secure=production,
    )
    
    response.delete_cookie(
        key="refresh_token",
        path="/api/auth/refresh",
        httponly=True,
        samesite="lax",
        secure=production,
    )
    return response


@router.post("/change-password")
async def change_password(
    request: Request,
    passwords: UserChangePassword,
    current_user: dict = Depends(get_current_user)
):
    """Change password and invalidate all existing sessions."""
    users = get_users_collection()
    
    # Verify old password
    if not verify_password(passwords.old_password, current_user["password_hash"]):
        logger.warning("LOGIN_FAILED: Wrong old password during change-password for user: %s", current_user["email"])
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect old password"
        )
        
    # Update password
    new_hash = hash_password(passwords.new_password)
    await users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"password_hash": new_hash}}
    )
    
    # Invalidate all sessions
    user_id = str(current_user["_id"])
    sessions = get_sessions_collection()
    await sessions.delete_many({"user_id": user_id})
    logger.info("TOKEN_REVOKED: Password changed, all sessions revoked for user: %s", user_id)
    
    production = settings.ENVIRONMENT == "production"
    response = JSONResponse(content={"message": "Password updated successfully. Please log in again."})
    
    response.delete_cookie(
        key="access_token",
        path="/",
        httponly=True,
        samesite="lax",
        secure=production,
    )
    response.delete_cookie(
        key="refresh_token",
        path="/api/auth/refresh",
        httponly=True,
        samesite="lax",
        secure=production,
    )
    return response
