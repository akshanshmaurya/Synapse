"""
Chat History Routes
Endpoints for managing chat sessions and retrieving message history.
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import Optional
from datetime import datetime
from pydantic import BaseModel

from app.auth.dependencies import get_current_user
from app.services.chat_service import chat_service

router = APIRouter(prefix="/api/chats", tags=["chats"])


class CreateChatRequest(BaseModel):
    title: Optional[str] = "New Conversation"


class UpdateChatRequest(BaseModel):
    title: str


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
