"""
Memory Agent
Stores and retrieves user profile, struggles, and progress.
No user-facing output - writes to MongoDB.
"""
import google.generativeai as genai
import os
from datetime import datetime
from typing import Dict, Any, Optional, List
from bson import ObjectId

from app.db.mongodb import get_user_memory_collection, get_interactions_collection
from app.models.memory import UserMemory, Struggle, UserProfile, UserProgress

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

class MemoryAgent:
    def __init__(self):
        self.model = genai.GenerativeModel("gemini-2.5-flash")
    
    async def get_user_context(self, user_id: str) -> Dict[str, Any]:
        """
        Retrieve user context for other agents to use.
        Returns a summary of profile, struggles, and progress.
        """
        memory_collection = get_user_memory_collection()
        memory = await memory_collection.find_one({"user_id": user_id})
        
        if not memory:
            # Create initial memory
            memory_doc = UserMemory(user_id=user_id).model_dump(exclude={"id"})
            await memory_collection.insert_one(memory_doc)
            memory = memory_doc
        
        # Get recent interactions for context
        interactions = get_interactions_collection()
        recent = await interactions.find(
            {"user_id": user_id}
        ).sort("created_at", -1).limit(5).to_list(length=5)
        
        context = {
            "profile": memory.get("profile", {}),
            "struggles": memory.get("struggles", []),
            "progress": memory.get("progress", {}),
            "context_summary": memory.get("context_summary", ""),
            "recent_interactions": [
                {"user": i["user_message"], "mentor": i["mentor_response"][:200]}
                for i in recent
            ]
        }
        
        return context
    
    async def store_interaction(
        self, 
        user_id: str, 
        session_id: str,
        user_message: str, 
        mentor_response: str,
        planner_strategy: Optional[Dict] = None,
        evaluator_insights: Optional[Dict] = None
    ):
        """Store an interaction in the database"""
        interactions = get_interactions_collection()
        
        interaction_doc = {
            "user_id": user_id,
            "session_id": session_id,
            "user_message": user_message,
            "mentor_response": mentor_response,
            "planner_strategy": planner_strategy,
            "evaluator_insights": evaluator_insights,
            "created_at": datetime.utcnow()
        }
        
        await interactions.insert_one(interaction_doc)
        
        # Update progress count
        memory_collection = get_user_memory_collection()
        await memory_collection.update_one(
            {"user_id": user_id},
            {
                "$inc": {"progress.total_interactions": 1},
                "$set": {
                    "progress.last_session": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
            }
        )
    
    async def update_struggle(
        self, 
        user_id: str, 
        topic: str, 
        severity: str = "mild",
        notes: Optional[str] = None
    ):
        """Record or update a struggle topic"""
        memory_collection = get_user_memory_collection()
        memory = await memory_collection.find_one({"user_id": user_id})
        
        if not memory:
            return
        
        struggles = memory.get("struggles", [])
        
        # Check if struggle already exists
        existing = None
        for s in struggles:
            if s.get("topic", "").lower() == topic.lower():
                existing = s
                break
        
        if existing:
            existing["count"] = existing.get("count", 1) + 1
            existing["last_seen"] = datetime.utcnow()
            existing["severity"] = severity
            if notes:
                existing["notes"] = notes
        else:
            struggles.append({
                "topic": topic,
                "count": 1,
                "severity": severity,
                "last_seen": datetime.utcnow(),
                "notes": notes
            })
        
        await memory_collection.update_one(
            {"user_id": user_id},
            {"$set": {"struggles": struggles, "updated_at": datetime.utcnow()}}
        )
    
    async def update_profile(
        self, 
        user_id: str, 
        interests: Optional[List[str]] = None,
        goals: Optional[List[str]] = None,
        stage: Optional[str] = None,
        learning_pace: Optional[str] = None
    ):
        """Update user profile information"""
        memory_collection = get_user_memory_collection()
        
        update_doc = {"updated_at": datetime.utcnow()}
        
        if interests is not None:
            update_doc["profile.interests"] = interests
        if goals is not None:
            update_doc["profile.goals"] = goals
        if stage is not None:
            update_doc["profile.stage"] = stage
        if learning_pace is not None:
            update_doc["profile.learning_pace"] = learning_pace
        
        await memory_collection.update_one(
            {"user_id": user_id},
            {"$set": update_doc}
        )
    
    async def generate_context_summary(self, user_id: str) -> str:
        """
        Use AI to generate a concise context summary for the user.
        This helps other agents understand the user quickly.
        """
        context = await self.get_user_context(user_id)
        
        prompt = f"""Based on this user's profile and history, create a brief 2-3 sentence summary 
that captures who they are and where they are in their journey.

Profile: {context['profile']}
Struggles: {context['struggles'][:3]}
Progress: {context['progress']}

Write a warm, person-focused summary (not a list). Start with their stage of growth."""

        try:
            response = self.model.generate_content(prompt)
            summary = response.text.strip()
            
            # Store the summary
            memory_collection = get_user_memory_collection()
            await memory_collection.update_one(
                {"user_id": user_id},
                {"$set": {"context_summary": summary, "updated_at": datetime.utcnow()}}
            )
            
            return summary
        except Exception as e:
            print(f"Memory Agent error: {e}")
            return ""
