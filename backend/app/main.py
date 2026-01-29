"""
Synapse API
Multi-agent AI mentor backend with MongoDB and JWT authentication.
"""
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel
from contextlib import asynccontextmanager
import os
import traceback
from dotenv import load_dotenv

load_dotenv()

from app.db.mongodb import MongoDB, get_user_memory_collection
from app.services.agent_orchestrator import AgentOrchestrator
from app.auth.dependencies import get_current_user, get_current_user_optional

# Lifespan for MongoDB connection
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        MongoDB.connect()
        print("✅ MongoDB connected successfully")
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")
    yield
    # Shutdown
    MongoDB.close()

app = FastAPI(title="Synapse API", lifespan=lifespan)

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"❌ Unhandled exception: {exc}")
    print(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"}
    )

# CORS - Allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Register routes
from app.routes.auth import router as auth_router
from app.routes.roadmap import router as roadmap_router
from app.routes.onboarding import router as onboarding_router

app.include_router(auth_router)
app.include_router(roadmap_router)
app.include_router(onboarding_router)

# Orchestrator instance
orchestrator = AgentOrchestrator()

# --- Request/Response Models ---

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str
    requires_onboarding: bool = False

class TTSRequest(BaseModel):
    text: str

# --- Helper Functions ---

async def check_onboarding_complete(user_id: str) -> bool:
    """Check if user has completed onboarding"""
    memory_collection = get_user_memory_collection()
    memory = await memory_collection.find_one({"user_id": user_id})
    if not memory:
        return False
    return memory.get("onboarding", {}).get("is_complete", False)

# --- Endpoints ---

@app.get("/")
def read_root():
    return {"message": "Synapse Backend is running", "version": "2.0"}

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Main chat endpoint - requires authentication.
    BLOCKS access until onboarding is complete.
    """
    user_id = str(current_user["_id"])
    
    # Check onboarding status
    if not await check_onboarding_complete(user_id):
        return ChatResponse(
            response="Before we begin our journey together, I'd like to learn a little about you. Please complete your onboarding first.",
            requires_onboarding=True
        )
    
    try:
        response_text = await orchestrator.process_message_async(user_id, request.message)
        return ChatResponse(response=response_text)
    except Exception as e:
        print(f"Chat API Error: {e}")
        return ChatResponse(
            response="I'm having a moment of reflection. Could you share that thought again?"
        )

@app.post("/api/chat/guest", response_model=ChatResponse)
async def chat_guest_endpoint(request: ChatRequest, guest_id: str = None):
    """
    Guest chat endpoint - no auth required.
    Limited functionality without onboarding.
    """
    try:
        user_id = guest_id or f"guest_{os.urandom(8).hex()}"
        response_text = await orchestrator.process_message_async(user_id, request.message)
        return ChatResponse(response=response_text)
    except Exception as e:
        print(f"Guest Chat Error: {e}")
        return ChatResponse(
            response="I'm having a moment of reflection. Could you share that thought again?"
        )

@app.post("/api/tts")
async def tts_endpoint(request: TTSRequest):
    """Text-to-speech endpoint"""
    from app.services.tts import generate_audio
    
    audio_content = generate_audio(request.text)
    if not audio_content:
        raise HTTPException(status_code=500, detail="TTS generation failed")
    
    return Response(content=audio_content, media_type="audio/mpeg")

@app.get("/api/user/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user's info including onboarding status"""
    from app.models.user import UserResponse
    from datetime import datetime
    
    user_id = str(current_user["_id"])
    onboarding_complete = await check_onboarding_complete(user_id)
    
    return {
        "id": user_id,
        "email": current_user["email"],
        "name": current_user.get("name"),
        "created_at": current_user.get("created_at", datetime.utcnow()),
        "onboarding_complete": onboarding_complete
    }

@app.get("/api/user/memory")
async def get_user_memory(current_user: dict = Depends(get_current_user)):
    """Get current user's memory/profile data"""
    user_id = str(current_user["_id"])
    memory_collection = get_user_memory_collection()
    memory = await memory_collection.find_one({"user_id": user_id})
    
    if memory:
        memory["_id"] = str(memory["_id"])
    
    return {"memory": memory}

@app.put("/api/user/profile")
async def update_user_profile(
    interests: list = None,
    goals: list = None,
    current_user: dict = Depends(get_current_user)
):
    """Update user profile"""
    from app.agents.memory_agent import MemoryAgent
    
    user_id = str(current_user["_id"])
    memory = MemoryAgent()
    
    await memory.update_profile(user_id, interests=interests, goals=goals)
    
    return {"success": True, "message": "Profile updated"}
