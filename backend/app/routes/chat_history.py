"""
Chat History Routes
Endpoints for managing chat sessions and retrieving message history.
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field

from app.auth.dependencies import get_current_user
from app.services.chat_service import chat_service

router = APIRouter(prefix="/api/chats", tags=["chats"])


class CreateChatRequest(BaseModel):
    title: Optional[str] = Field("New Conversation", max_length=200)


class UpdateChatRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)


# --- Chat Session Endpoints ---

@router.get("")
async def get_user_chats(
    user: dict = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0)
):
    """
    Get paginated list of user's chat sessions.
    Ordered by most recently updated.
    """
    user_id = str(user["_id"])  # Convert ObjectId to string
    
    sessions = await chat_service.get_user_chats(
        user_id=user_id,
        limit=limit,
        offset=offset
    )
    
    return {
        "chats": sessions,
        "limit": limit,
        "offset": offset
    }


@router.post("")
async def create_chat_session(
    request: CreateChatRequest,
    user: dict = Depends(get_current_user)
):
    """Create a new chat session."""
    user_id = str(user["_id"])  # Convert ObjectId to string
    
    chat_id = await chat_service.create_chat_session(
        user_id=user_id,
        title=request.title or "New Conversation"
    )
    
    return {
        "chat_id": chat_id,
        "title": request.title
    }


@router.get("/{chat_id}/messages")
async def get_chat_messages(
    chat_id: str,
    user: dict = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=100),
    before: Optional[str] = None
):
    """
    Get paginated messages for a chat session.
    Uses cursor-based pagination via 'before' timestamp.
    """
    before_timestamp = None
    if before:
        try:
            before_timestamp = datetime.fromisoformat(before)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid timestamp format. Use ISO format."
            )
    
    messages = await chat_service.get_chat_messages(
        chat_id=chat_id,
        limit=limit,
        before_timestamp=before_timestamp
    )
    
    return {
        "messages": messages,
        "chat_id": chat_id,
        "count": len(messages)
    }


@router.patch("/{chat_id}")
async def update_chat(
    chat_id: str,
    request: UpdateChatRequest,
    user: dict = Depends(get_current_user)
):
    """Update a chat session's title."""
    success = await chat_service.update_chat_title(chat_id, request.title)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found"
        )
    
    return {"success": True}


@router.delete("/{chat_id}")
async def delete_chat_session(
    chat_id: str,
    user: dict = Depends(get_current_user)
):
    """Delete a chat session and all its messages."""
    user_id = str(user["_id"])  # Convert ObjectId to string
    
    success = await chat_service.delete_chat_session(
        chat_id=chat_id,
        user_id=user_id
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found or not owned by user"
        )
    
    return {"success": True}


# --- Session Context Endpoint (Phase 4.7) ---

@router.get("/{chat_id}/context")
async def get_chat_context(
    chat_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Get the full session context for a chat (Phase 5+ frontend feature).

    Returns three-layer snapshot:
      - session: goal, domain, clarity, momentum, active_concepts, confusion_points, message_count
      - concepts: active concept details (mastery, misconceptions, exposure)
      - profile_summary: experience_level, learning_style, mentoring_tone

    If any layer fails, returns partial data with defaults.
    """
    from app.services.session_context_service import session_context_service
    from app.services.concept_memory_service import concept_memory_service
    from app.services.profile_service import profile_service
    from app.utils.logger import logger

    user_id = str(user["_id"])

    # --- Session layer ---
    try:
        session = await session_context_service.get_session_summary(chat_id)
    except Exception as e:
        logger.error("get_chat_context: session fetch failed: %s", e)
        session = {
            "goal": None, "domain": None, "clarity": 50.0,
            "momentum": "cold_start", "active_concepts": [],
            "confusion_points": [], "message_count": 0,
        }

    # --- Concept layer ---
    try:
        concepts = await concept_memory_service.get_concept_context_for_agents(
            user_id, session.get("active_concepts", [])
        )
    except Exception as e:
        logger.error("get_chat_context: concept fetch failed: %s", e)
        concepts = {"active": {}, "related_weak": [], "overall_mastery_average": 0.0}

    # --- Profile layer ---
    try:
        profile_summary = await profile_service.get_profile_context_for_agents(user_id)
    except Exception as e:
        logger.error("get_chat_context: profile fetch failed: %s", e)
        profile_summary = {
            "experience_level": "beginner",
            "preferred_learning_style": "mixed",
            "mentoring_tone": "balanced",
            "career_interests": [],
            "strengths_summary": [],
            "weaknesses_summary": [],
        }

    return {
        "session": session,
        "concepts": concepts,
        "profile_summary": profile_summary,
    }
