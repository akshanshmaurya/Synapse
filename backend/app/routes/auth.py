"""
Authentication Routes
Login and Signup endpoints with proper error handling
"""
from fastapi import APIRouter, HTTPException, status
from datetime import datetime
from bson import ObjectId
import traceback

from app.models.user import UserCreate, UserLogin, UserResponse, TokenResponse
from app.auth.password import hash_password, verify_password
from app.auth.jwt_handler import create_access_token
from app.db.mongodb import get_users_collection, get_user_memory_collection, MongoDB
from app.models.memory import UserMemory, Onboarding
from app.utils.logger import log_debug, log_error

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/signup", response_model=TokenResponse)
async def signup(user_data: UserCreate):
    """Create a new user account"""
    try:
        # Check database connection
        if MongoDB.db is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database connection not available"
            )
        
        users = get_users_collection()
        
        # Check if user already exists
        existing = await users.find_one({"email": user_data.email.lower()})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists"
            )
        
        # Create user document
        print(f"Debug: Registering user {user_data.email}, password length: {len(user_data.password)}")
        user_doc = {
            "email": user_data.email.lower(),
            "password_hash": hash_password(user_data.password),
            "name": user_data.name or user_data.email.split("@")[0],
            "created_at": datetime.utcnow(),
            "last_login": datetime.utcnow()
        }
        
        result = await users.insert_one(user_doc)
        user_id = str(result.inserted_id)
        
        # Initialize user memory with proper structure
        memory_collection = get_user_memory_collection()
        memory_doc = UserMemory(
            user_id=user_id,
            onboarding=Onboarding()
        ).model_dump(exclude={"id"}, by_alias=False)
        
        await memory_collection.insert_one(memory_doc)
        
        # Create JWT token
        access_token = create_access_token(data={"sub": user_id})
        
        return TokenResponse(
            access_token=access_token,
            user=UserResponse(
                id=user_id,
                email=user_doc["email"],
                name=user_doc["name"],
                created_at=user_doc["created_at"]
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        log_error("SIGNUP FAILED", traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed. Please try again later."
        )

@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """Login with email and password"""
    try:
        # Check database connection
        if MongoDB.db is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service unavailable"
            )
        
        users = get_users_collection()
        
        # Find user
        user = await users.find_one({"email": credentials.email.lower()})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Check your email or password and try again."
            )
        
        # Verify password
        if not verify_password(credentials.password, user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Check your email or password and try again."
            )
        
        # Update last login
        await users.update_one(
            {"_id": user["_id"]},
            {"$set": {"last_login": datetime.utcnow()}}
        )
        
        user_id = str(user["_id"])
        
        # Create JWT token
        access_token = create_access_token(data={"sub": user_id})
        
        return TokenResponse(
            access_token=access_token,
            user=UserResponse(
                id=user_id,
                email=user["email"],
                name=user.get("name"),
                created_at=user["created_at"]
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        print("\n" + "="*50)
        print(f"❌ LOGIN ERROR: {e}")
        print(traceback.format_exc())
        print("="*50 + "\n")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed. Please try again later."
        )

@router.get("/health")
async def health_check():
    """Health check endpoint for debugging"""
    try:
        if MongoDB.db is None:
            return {"status": "error", "database": "disconnected"}
        
        # Try a simple query
        users = get_users_collection()
        count = await users.count_documents({})
        
        return {
            "status": "healthy",
            "database": "connected",
            "user_count": count
        }
    except Exception as e:
        return {
            "status": "error",
            "database": "error",
            "error": str(e)
        }
