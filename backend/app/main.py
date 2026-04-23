"""
Synapse API
Multi-agent AI mentor backend with MongoDB and JWT authentication.

Production-grade hardening:
- HttpOnly cookie-based JWT auth (see auth/dependencies.py)
- Role-based access control (RBAC) — see core/authorization.py
- Rate limiting (custom in-memory) — see core/rate_limiter.py
- CORS restriction (environment-based origins) — see core/cors.py
- Security headers middleware — see core/security_headers.py, core/middleware.py
- CSRF protection (JSON-only state-changing requests) — see core/csrf.py
- Input validation (Pydantic models with Field constraints)
- XSS prevention (bleach-based sanitization) — see utils/sanitizer.py
- Structured logging with request correlation
- Health check endpoint

SQL Injection: NOT APPLICABLE — this application uses MongoDB (document store
with BSON queries). MongoDB is not vulnerable to SQL injection. All user
inputs are passed through Pydantic validation and bleach sanitization before
reaching the database layer, preventing NoSQL injection as well.
"""
from fastapi import FastAPI, HTTPException, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field
from typing import Optional
from contextlib import asynccontextmanager
import uuid

from app.core.config import settings
from app.core.middleware import SecurityHeadersMiddleware
from app.core.csrf import CSRFProtectionMiddleware
from app.core.cors import CORS_CONFIG
from app.core.rate_limiter import rate_limit
from app.db.mongodb import MongoDB, get_user_memory_collection
from app.services.agent_orchestrator import AgentOrchestrator
from app.auth.dependencies import get_current_user, get_current_user_optional
from app.core.authorization import require_admin, require_authenticated_user  # noqa: F401 — RBAC
from app.services.report_service import report_service
from app.utils.logger import logger
from app.utils.sanitizer import sanitize_text


# --- Lifespan ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await MongoDB.connect()
    except Exception as e:
        logger.error("MongoDB connection failed: %s", e, exc_info=True)
    yield
    MongoDB.close()


app = FastAPI(title="Synapse API", lifespan=lifespan)


# --- Global Exception Handlers ---
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": True, "code": "INTERNAL_ERROR", "message": "Internal server error"},
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    # Standardize HTTP exceptions
    # Some built-in fastAPI exceptions don't have code, so we derive one from status
    code_map = {
        status.HTTP_400_BAD_REQUEST: "BAD_REQUEST",
        status.HTTP_401_UNAUTHORIZED: "UNAUTHORIZED",
        status.HTTP_403_FORBIDDEN: "FORBIDDEN",
        status.HTTP_404_NOT_FOUND: "NOT_FOUND",
        status.HTTP_429_TOO_MANY_REQUESTS: "RATE_LIMIT_EXCEEDED",
    }
    code = code_map.get(exc.status_code, "ERROR")
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": True, "code": code, "message": exc.detail},
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": True, "code": "VALIDATION_ERROR", "message": str(exc.errors())},
    )

# --- Middleware ---
# NOTE: Starlette applies middleware in REVERSE order of add_middleware() calls.
# The LAST middleware added is the OUTERMOST (runs first on request).

# Security headers (runs third — see core/security_headers.py for header list)
app.add_middleware(SecurityHeadersMiddleware)

# CSRF protection (runs after CORS, before Security headers — see core/csrf.py)
app.add_middleware(CSRFProtectionMiddleware)

# CORS (runs second — see core/cors.py for allowed origins, methods, headers)
app.add_middleware(CORSMiddleware, **CORS_CONFIG)



# --- Register Routes ---
from app.routes.auth import router as auth_router
from app.routes.roadmap import router as roadmap_router
from app.routes.onboarding import router as onboarding_router
from app.routes.chat_history import router as chat_history_router
from app.routes.trace import router as trace_router
from app.routes.analytics import router as analytics_router
from app.routes.ws_chat import router as ws_chat_router

app.include_router(auth_router)
app.include_router(roadmap_router)
app.include_router(onboarding_router)
app.include_router(chat_history_router)
app.include_router(trace_router)
app.include_router(analytics_router)
app.include_router(ws_chat_router)

# Orchestrator instance
orchestrator = AgentOrchestrator()


# --- Request/Response Models (with validation) ---

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    chat_id: str = None
    session_goal: str = None  # Optional — user can explicitly set a session learning goal


class GoalUpdateRequest(BaseModel):
    goal: str
    confirmed: bool = True


class EvaluationData(BaseModel):
    """Session-scoped evaluation snapshot (NOT global clarity)."""
    clarity_score: float = 50.0
    understanding_delta: int = 0
    confusion_trend: str = "stable"
    engagement_level: str = "medium"


class SessionContextData(BaseModel):
    """Lightweight session state for frontend session-aware UI."""
    goal: Optional[str] = None
    momentum: str = "cold_start"
    active_concepts: list = []
    message_count: int = 0


class ChatResponse(BaseModel):
    response: str
    chat_id: str = None
    requires_onboarding: bool = False
    evaluation: EvaluationData = None      # Session-scoped clarity, not global
    session_context: SessionContextData = None  # NEW — omitted if v2 services unavailable


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
        sanitized_message = sanitize_text(body.message)
        result = await orchestrator.process_message_async(
            user_id,
            sanitized_message,
            chat_id=body.chat_id,
            session_goal=body.session_goal,
        )

        # Build typed evaluation sub-model
        eval_data = None
        if result.get("evaluation"):
            eval_data = EvaluationData(**result["evaluation"])

        # Build typed session context sub-model (None when v2 unavailable)
        ctx_data = None
        if result.get("session_context"):
            ctx_data = SessionContextData(**result["session_context"])

        return ChatResponse(
            response=result["response"],
            chat_id=result["chat_id"],
            evaluation=eval_data,
            session_context=ctx_data,
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
        user_id = guest_id or f"guest_{uuid.uuid4().hex}"
        sanitized_message = sanitize_text(body.message)
        response_text = await orchestrator.process_message_async(user_id, sanitized_message)
        return ChatResponse(response=response_text)
    except Exception as e:
        logger.error("Guest chat error: %s", e)
        return ChatResponse(
            response="I'm having a moment of reflection. Could you share that thought again?"
        )

@app.get("/api/chats/{chat_id}/context")
async def get_session_context(
    chat_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Fetch the full session context for a chat — used by Session Context UI."""
    from bson import ObjectId
    from app.db.mongodb import get_chats_collection
    from app.services.session_context_service import session_context_service

    user_id = str(current_user["_id"])

    # Verify ownership
    try:
        chats = get_chats_collection()
        chat = await chats.find_one({"_id": ObjectId(chat_id)})
        if not chat or str(chat.get("user_id")) != user_id:
            raise HTTPException(status_code=404, detail="Chat not found or access denied")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid chat ID format")

    summary = await session_context_service.get_session_summary(chat_id)
    summary["user_id"] = user_id
    return summary


@app.patch("/api/chats/{chat_id}/context/goal")
async def update_session_goal(
    chat_id: str,
    request_body: GoalUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Allow user to manually set or confirm the inferred goal."""
    from bson import ObjectId
    from app.db.mongodb import get_chats_collection
    from app.services.session_context_service import session_context_service

    user_id = str(current_user["_id"])
    
    # Verify ownership
    try:
        chats = get_chats_collection()
        chat = await chats.find_one({"_id": ObjectId(chat_id)})
        if not chat or str(chat.get("user_id")) != user_id:
            raise HTTPException(status_code=404, detail="Chat not found or access denied")
    except Exception as e:
        logger.error(f"Error fetching chat: {e}")
        raise HTTPException(status_code=400, detail="Invalid chat ID format")
        
    # Update Goal in session_contexts
    try:
        sanitized_goal = sanitize_text(request_body.goal) if request_body.goal else request_body.goal
        await session_context_service.update_session(
            session_id=chat_id,
            updates={
                "session_goal": sanitized_goal,
                "goal_inferred": not request_body.confirmed, 
                "goal_confirmed": request_body.confirmed
            }
        )
        return {"success": True, "goal": sanitized_goal, "confirmed": request_body.confirmed}
    except Exception as e:
        logger.error(f"Failed to update session goal: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


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


# --- Concept Map Endpoints ---

@app.get("/api/user/concept-map")
async def get_concept_map(current_user: dict = Depends(get_current_user)):
    """Return all user concepts as nodes and inferred prerequisite edges for graph visualization."""
    from app.services.concept_memory_service import concept_memory_service

    user_id = str(current_user["_id"])
    user_concepts = await concept_memory_service.get_user_concepts(user_id)
    concepts = user_concepts.concepts or {}

    nodes = []
    edges = []

    for cid, record in concepts.items():
        status = "mastered" if record.mastery_level >= 0.85 else \
                 "proficient" if record.mastery_level >= 0.6 else \
                 "developing" if record.mastery_level >= 0.3 else "novice"
        nodes.append({
            "concept_id": cid,
            "concept_name": record.concept_name,
            "domain": record.domain,
            "mastery_level": round(record.mastery_level, 3),
            "exposure_count": record.exposure_count,
            "last_clarity_score": record.last_clarity_score,
            "misconceptions": record.misconceptions[:5] if record.misconceptions else [],
            "first_seen": record.first_seen.isoformat() if record.first_seen else None,
            "last_seen": record.last_seen.isoformat() if record.last_seen else None,
            "mastery_history": [
                {"date": s.date.isoformat(), "score": round(s.score, 3)}
                for s in (record.mastery_history or [])[-10:]
            ],
            "status": status,
        })

    # Build prerequisite edges: within the same domain, lower-mastery concepts
    # that were first seen before higher-mastery ones are inferred prerequisites.
    domain_groups: dict = {}
    for node in nodes:
        domain_groups.setdefault(node["domain"], []).append(node)

    for domain, group in domain_groups.items():
        sorted_by_time = sorted(group, key=lambda n: n["first_seen"] or "")
        for i in range(len(sorted_by_time) - 1):
            # Only create prerequisite edge if the earlier concept has some mastery
            earlier = sorted_by_time[i]
            later = sorted_by_time[i + 1]
            if earlier["mastery_level"] > 0.1:
                edges.append({
                    "from": earlier["concept_id"],
                    "to": later["concept_id"],
                    "type": "prerequisite",
                })

    return {"nodes": nodes, "edges": edges}


@app.get("/api/user/recommendations")
async def get_zpd_recommendations(current_user: dict = Depends(get_current_user)):
    """Return ZPD recommendations, learning velocity, and recent session history."""
    from app.services.concept_memory_service import concept_memory_service
    from app.db.mongodb import get_chats_collection, get_session_contexts_collection
    from datetime import datetime, timedelta

    user_id = str(current_user["_id"])
    user_concepts = await concept_memory_service.get_user_concepts(user_id)
    concepts = user_concepts.concepts or {}

    # ── 1. Next Steps (ZPD recommendations) ─────────────────────────────
    next_steps = []
    if concepts:
        weak = await concept_memory_service.get_weak_concepts(user_id, threshold=0.6)
        for record in weak[:6]:
            domain_peers = [
                v for v in concepts.values()
                if v.domain == record.domain and v.concept_id != record.concept_id
            ]
            avg_peer_mastery = (
                sum(p.mastery_level for p in domain_peers) / len(domain_peers)
                if domain_peers else 0.0
            )
            readiness = min(1.0, avg_peer_mastery * 0.6 + min(record.exposure_count, 5) * 0.08)
            reason = (
                f"You have strong foundations in related {record.domain} concepts"
                if avg_peer_mastery > 0.5
                else f"You've seen this {record.exposure_count} times — keep going"
                if record.exposure_count > 1
                else "A natural next step based on your learning path"
            )
            next_steps.append({
                "concept_id": record.concept_id,
                "concept_name": record.concept_name,
                "domain": record.domain,
                "mastery_level": round(record.mastery_level, 3),
                "readiness": round(readiness, 3),
                "reason": reason,
            })
        next_steps.sort(key=lambda r: r["readiness"], reverse=True)
        next_steps = next_steps[:3]

    # ── 2. Learning Velocity ────────────────────────────────────────────
    mastered_count = sum(1 for c in concepts.values() if c.mastery_level >= 0.85)
    in_progress_count = sum(1 for c in concepts.values() if 0.1 <= c.mastery_level < 0.85)
    all_mastery = [c.mastery_level for c in concepts.values()]
    avg_mastery = sum(all_mastery) / len(all_mastery) if all_mastery else 0.0

    # Build a 7-day sparkline from mastery history across all concepts
    now = datetime.utcnow()
    sparkline = []
    for days_ago in range(6, -1, -1):
        day = (now - timedelta(days=days_ago)).strftime("%Y-%m-%d")
        day_scores = []
        for c in concepts.values():
            history = getattr(c, "mastery_history", []) or []
            for h in history:
                h_date = h.get("date", "") if isinstance(h, dict) else ""
                if h_date == day:
                    day_scores.append(h.get("score", 0) if isinstance(h, dict) else 0)
        sparkline.append(round(sum(day_scores) / len(day_scores), 3) if day_scores else None)

    # Fill None with previous value for continuity
    for i in range(len(sparkline)):
        if sparkline[i] is None:
            sparkline[i] = sparkline[i - 1] if i > 0 and sparkline[i - 1] is not None else 0.0

    # Velocity label + trend
    if len(all_mastery) < 3:
        vel_label, vel_trend = "insufficient_data", "stable"
        vel_insight = "Keep learning — we need a few more sessions to map your pace."
    else:
        recent_vals = [v for v in sparkline[-3:] if v and v > 0]
        older_vals = [v for v in sparkline[:4] if v and v > 0]
        recent_avg = sum(recent_vals) / len(recent_vals) if recent_vals else 0
        older_avg = sum(older_vals) / len(older_vals) if older_vals else 0
        delta = recent_avg - older_avg

        if avg_mastery >= 0.7:
            vel_label = "fast"
        elif avg_mastery >= 0.4:
            vel_label = "steady"
        else:
            vel_label = "slow"

        if delta > 0.05:
            vel_trend = "improving"
        elif delta < -0.05:
            vel_trend = "declining"
        else:
            vel_trend = "stable"

        vel_insight = (
            f"You've mastered {mastered_count} concepts with {in_progress_count} in progress — "
            + ("strong momentum, keep pushing!" if vel_label == "fast"
               else "steady growth, you're on track." if vel_label == "steady"
               else "take your time, depth matters more than speed.")
        )

    velocity = {
        "label": vel_label,
        "trend": vel_trend,
        "insight": vel_insight,
        "mastered_count": mastered_count,
        "in_progress_count": in_progress_count,
        "mastery_sparkline": sparkline,
    }

    # ── 3. Recent Sessions ──────────────────────────────────────────────
    recent_sessions = []
    try:
        ctx_collection = get_session_contexts_collection()
        cursor = ctx_collection.find(
            {"user_id": user_id}
        ).sort("updated_at", -1).limit(5)

        async for doc in cursor:
            goal = doc.get("session_goal")
            clarity = doc.get("session_clarity", 0)
            effectiveness = (
                "good" if clarity >= 70
                else "moderate" if clarity >= 40
                else "low"
            )
            active = doc.get("active_concepts", [])
            recent_sessions.append({
                "session_id": doc.get("session_id", ""),
                "date": doc.get("updated_at", doc.get("created_at", "")),
                "goal": goal,
                "effectiveness": effectiveness,
                "concepts_improved": active[:5] if active else [],
            })
    except Exception as e:
        logger.warning(f"Failed to fetch recent sessions: {e}")

    return {
        "next_steps": next_steps,
        "velocity": velocity,
        "recent_sessions": recent_sessions,
        # Keep backwards compat alias
        "recommendations": next_steps,
    }


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


@app.get("/api/user/report")
async def get_learning_report(current_user: dict = Depends(get_current_user)):
    """Return a comprehensive learning outcome report for the user."""
    user_id = str(current_user["_id"])
    return await report_service.generate_report(user_id)


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
