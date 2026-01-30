"""
Chat Service
Manages chat sessions and messages separately from memory.
Provides context window management for LLM calls.
"""
from datetime import datetime
from typing import List, Optional, Dict, Any
from bson import ObjectId

from app.db.mongodb import get_chats_collection, get_messages_collection
from app.models.chat import (
    ChatSession, ChatMessage, MessageSender, MessageMetadata,
    CONTEXT_WINDOW_SIZE, MAX_CONTEXT_TOKENS
)


class ChatService:
    """Service for managing chat history and context"""
    
    async def create_chat_session(self, user_id: str, title: str = "New Conversation") -> str:
        """
        Create a new chat session.
        Returns the chat_id.
        """
        chats = get_chats_collection()
        
        session = {
            "user_id": user_id,
            "title": title,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "message_count": 0,
            "last_message_preview": None,
            "is_active": True,
            "context_summary": None
        }
        
        result = await chats.insert_one(session)
        return str(result.inserted_id)
    
    async def get_user_chats(
        self, 
        user_id: str, 
        limit: int = 20, 
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get paginated list of user's chat sessions.
        Ordered by most recently updated.
        """
        chats = get_chats_collection()
        
        cursor = chats.find({"user_id": user_id}).sort(
            "updated_at", -1
        ).skip(offset).limit(limit)
        
        sessions = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            sessions.append(doc)
        
        return sessions
    
    async def get_chat_messages(
        self,
        chat_id: str,
        limit: int = 50,
        before_timestamp: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Get paginated messages for a chat session.
        Uses cursor-based pagination via timestamp.
        """
        messages = get_messages_collection()
        
        query = {"chat_id": chat_id}
        if before_timestamp:
            query["timestamp"] = {"$lt": before_timestamp}
        
        cursor = messages.find(query).sort("timestamp", -1).limit(limit)
        
        result = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            result.append(doc)
        
        # Return in chronological order
        return list(reversed(result))
    
    async def add_message(
        self,
        chat_id: str,
        user_id: str,
        sender: MessageSender,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Add a message to a chat session.
        Updates session metadata.
        Returns message_id.
        """
        messages = get_messages_collection()
        chats = get_chats_collection()
        
        now = datetime.utcnow()
        
        message = {
            "chat_id": chat_id,
            "user_id": user_id,
            "sender": sender.value,
            "content": content,
            "timestamp": now,
            "metadata": metadata or {}
        }
        
        result = await messages.insert_one(message)
        
        # Update session metadata
        preview = content[:100] + "..." if len(content) > 100 else content
        await chats.update_one(
            {"_id": ObjectId(chat_id)},
            {
                "$set": {
                    "updated_at": now,
                    "last_message_preview": preview
                },
                "$inc": {"message_count": 1}
            }
        )
        
        return str(result.inserted_id)
    
    async def get_context_window(
        self,
        chat_id: str,
        n: int = CONTEXT_WINDOW_SIZE
    ) -> List[Dict[str, Any]]:
        """
        Get the last N messages for LLM context.
        This is the sliding window used for generation.
        """
        messages = get_messages_collection()
        
        cursor = messages.find({"chat_id": chat_id}).sort(
            "timestamp", -1
        ).limit(n)
        
        result = []
        async for doc in cursor:
            result.append({
                "sender": doc["sender"],
                "content": doc["content"],
                "timestamp": doc["timestamp"]
            })
        
        # Return in chronological order
        return list(reversed(result))
    
    async def format_context_for_llm(
        self,
        chat_id: str,
        n: int = CONTEXT_WINDOW_SIZE
    ) -> str:
        """
        Format recent messages as context string for LLM.
        Includes context summary if available.
        """
        chats = get_chats_collection()
        chat = await chats.find_one({"_id": ObjectId(chat_id)})
        
        context_parts = []
        
        # Include summary of older messages if available
        if chat and chat.get("context_summary"):
            context_parts.append(f"[Earlier conversation summary: {chat['context_summary']}]")
        
        # Get recent messages
        messages = await self.get_context_window(chat_id, n)
        
        for msg in messages:
            role = "Student" if msg["sender"] == "user" else "Mentor"
            context_parts.append(f"{role}: {msg['content']}")
        
        return "\n".join(context_parts)
    
    async def get_message_count(self, chat_id: str) -> int:
        """Get the number of messages in a chat session."""
        messages = get_messages_collection()
        return await messages.count_documents({"chat_id": chat_id})
    
    async def get_or_create_active_chat(self, user_id: str) -> str:
        """
        Get the user's most recent active chat, or create a new one.
        """
        chats = get_chats_collection()
        
        # Find most recent active chat
        chat = await chats.find_one(
            {"user_id": user_id, "is_active": True},
            sort=[("updated_at", -1)]
        )
        
        if chat:
            return str(chat["_id"])
        
        # Create new session
        return await self.create_chat_session(user_id)
    
    async def delete_chat_session(self, chat_id: str, user_id: str) -> bool:
        """
        Delete a chat session and its messages.
        Verifies ownership.
        """
        chats = get_chats_collection()
        messages = get_messages_collection()
        
        # Verify ownership
        chat = await chats.find_one({"_id": ObjectId(chat_id), "user_id": user_id})
        if not chat:
            return False
        
        # Delete messages
        await messages.delete_many({"chat_id": chat_id})
        
        # Delete session
        await chats.delete_one({"_id": ObjectId(chat_id)})
        
        return True
    
    async def update_chat_title(self, chat_id: str, title: str) -> bool:
        """Update the title of a chat session"""
        chats = get_chats_collection()
        
        result = await chats.update_one(
            {"_id": ObjectId(chat_id)},
            {"$set": {"title": title}}
        )
        
        return result.modified_count > 0


# Singleton instance
chat_service = ChatService()
