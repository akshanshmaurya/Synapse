"""
Synapse API
Multi-agent AI mentor backend with MongoDB and JWT authentication.

Production-grade hardening:
- HttpOnly cookie-based JWT auth
- Rate limiting (custom in-memory)
- CORS restriction (environment-based origins)
- Security headers middleware
- Input validation (Pydantic)
- Structured logging
- Health check endpoint
"""
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.middleware import SecurityHeadersMiddleware
from app.core.rate_limiter import rate_limit
from app.db.mongodb import MongoDB, get_user_memory_collection
from app.services.agent_orchestrator import AgentOrchestrator
from app.auth.dependencies import get_current_user, get_current_user_optional
from app.utils.logger import logger


# --- Lifespan ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        MongoDB.connect()
        logger.info("MongoDB connected successfully")
    except Exception as e:
        logger.error("MongoDB connection failed: %s", e, exc_info=True)
    yield
    MongoDB.close()


app = FastAPI(title="Synapse API", lifespan=lifespan)


# --- Global Exception Handler ---
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# --- Middleware ---
# Security headers
app.add_middleware(SecurityHeadersMiddleware)

# CORS — restricted to configured origins (no wildcard)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# --- Register Routes ---
from app.routes.auth import router as auth_router
from app.routes.roadmap import router as roadmap_router
from app.routes.onboarding import router as onboarding_router
from app.routes.chat_history import router as chat_history_router
from app.routes.trace import router as trace_router

app.include_router(auth_router)
app.include_router(roadmap_router)
app.include_router(onboarding_router)
app.include_router(chat_history_router)
app.include_router(trace_router)

# Orchestrator instance
orchestrator = AgentOrchestrator()


# --- Request/Response Models (with validation) ---

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    chat_id: str = None


class ChatResponse(BaseModel):
    response: str
    chat_id: str = None
    requires_onboarding: bool = False


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)


# --- Helper Functions ---

async def check_onboarding_complete(user_id: str) -> bool:
    """Check if user has completed onboarding."""
    memory_collection = get_user_memory_collection()
    memory = await memory_collection.find_one({"user_id": user_id})
    if not memory:
        return False
    return memory.get("onboarding", {}).get("is_complete", False)


# --- Health Check ---

@app.get("/health")
async def health_check():
    """Health check with MongoDB connection status."""
    db_status = "connected" if MongoDB.db is not None else "disconnected"
    if MongoDB.db is not None:
        try:
            await MongoDB.client.admin.command("ping")
        except Exception:
            db_status = "error"

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "database": db_status,
        "environment": settings.ENVIRONMENT,
    }


# --- Root ---

@app.get("/")
def read_root():
    return {"message": "Synapse Backend is running", "version": "2.0"}


# --- Chat Endpoints ---

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(
    request: Request,
    body: ChatRequest,
    current_user: dict = Depends(get_current_user),
    _rate=Depends(rate_limit(30, 60, "chat")),
):
    """
    Main chat endpoint — rate limited to 30/min.
    Requires authentication and onboarding completion.
    """
    user_id = str(current_user["_id"])

    if not await check_onboarding_complete(user_id):
        return ChatResponse(
            response="Before we begin our journey together, I'd like to learn a little about you. Please complete your onboarding first.",
            requires_onboarding=True,
        )

    try:
        result = await orchestrator.process_message_async(
            user_id,
            body.message,
            chat_id=body.chat_id,
        )
        return ChatResponse(
            response=result["response"],
            chat_id=result["chat_id"],
        )
    except Exception as e:
        logger.error("Chat API error: %s", e, exc_info=True)
        return ChatResponse(
            response="I'm having a moment of reflection. Could you share that thought again?"
        )


@app.post("/api/chat/guest", response_model=ChatResponse)
async def chat_guest_endpoint(
    request: Request,
    body: ChatRequest,
    guest_id: str = None,
    _rate=Depends(rate_limit(10, 60, "guest_chat")),
):
    """Guest chat — rate limited to 10/min, no auth required."""
    try:
        import os

        user_id = guest_id or f"guest_{os.urandom(8).hex()}"
        response_text = await orchestrator.process_message_async(user_id, body.message)
        return ChatResponse(response=response_text)
    except Exception as e:
        logger.error("Guest chat error: %s", e)
        return ChatResponse(
            response="I'm having a moment of reflection. Could you share that thought again?"
        )


# --- TTS ---

@app.post("/api/tts")
async def tts_endpoint(request: TTSRequest):
    """Text-to-speech endpoint."""
    from app.services.tts import generate_audio

    audio_content = generate_audio(request.text)
    if not audio_content:
        raise HTTPException(status_code=500, detail="TTS generation failed")

    from fastapi.responses import Response

    return Response(content=audio_content, media_type="audio/mpeg")


# --- User Endpoints ---

@app.get("/api/user/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user's info including onboarding status."""
    from datetime import datetime

    user_id = str(current_user["_id"])
    onboarding_complete = await check_onboarding_complete(user_id)

    return {
        "id": user_id,
        "email": current_user["email"],
        "name": current_user.get("name"),
        "created_at": current_user.get("created_at", datetime.utcnow()),
        "onboarding_complete": onboarding_complete,
    }


@app.get("/api/user/memory")
async def get_user_memory(current_user: dict = Depends(get_current_user)):
    """Get current user's memory/profile data."""
    user_id = str(current_user["_id"])
    memory_collection = get_user_memory_collection()
    memory = await memory_collection.find_one({"user_id": user_id})

    if memory:
        memory["_id"] = str(memory["_id"])

    return {"memory": memory}


@app.get("/api/user/dashboard")
async def get_dashboard_data(current_user: dict = Depends(get_current_user)):
    """Get derived dashboard insights for the user."""
    from app.services.dashboard_service import DashboardService

    user_id = str(current_user["_id"])
    service = DashboardService()

    return await service.get_dashboard_insights(user_id)


@app.put("/api/user/profile")
async def update_user_profile(
    interests: list = None,
    goals: list = None,
    current_user: dict = Depends(get_current_user),
):
    """Update user profile."""
    from app.agents.memory_agent import MemoryAgent

    user_id = str(current_user["_id"])
    memory = MemoryAgent()

    await memory.update_profile(user_id, interests=interests, goals=goals)

    return {"success": True, "message": "Profile updated"}
