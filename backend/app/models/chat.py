"""
Chat Models for MongoDB
Stores chat sessions and messages separately from memory.

Architecture:
- ChatSession: metadata about a conversation
- ChatMessage: individual messages with sender, content, metadata
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum


class MessageSender(str, Enum):
    USER = "user"
    MENTOR = "mentor"


class MessageType(str, Enum):
    TEXT = "text"
    VOICE = "voice"
    SYSTEM = "system"


class ChatSession(BaseModel):
    """A chat conversation session"""
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    title: str = "New Conversation"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    message_count: int = 0
    last_message_preview: Optional[str] = None  # First 100 chars of last message
    is_active: bool = True
    
    # Optional context summary for long conversations
    context_summary: Optional[str] = None  # AI-generated summary of older messages
    
    class Config:
        populate_by_name = True


class MessageMetadata(BaseModel):
    """Metadata for a chat message"""
    voice_enabled: bool = False
    message_type: MessageType = MessageType.TEXT
    # Agent data (not for display, for debugging)
    planner_strategy: Optional[Dict[str, Any]] = None
    evaluator_insights: Optional[Dict[str, Any]] = None


class ChatMessage(BaseModel):
    """Individual message in a chat session"""
    id: Optional[str] = Field(None, alias="_id")
    chat_id: str  # Reference to ChatSession
    user_id: str
    sender: MessageSender
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: MessageMetadata = Field(default_factory=MessageMetadata)
    
    class Config:
        populate_by_name = True


# Context window size for LLM calls
CONTEXT_WINDOW_SIZE = 10
MAX_CONTEXT_TOKENS = 2000  # Approximate token budget for context
