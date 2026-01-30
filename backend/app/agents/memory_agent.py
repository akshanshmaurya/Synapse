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
    
    async def store_evaluation_result(self, user_id: str, evaluation: Dict[str, Any]):
        """
        Store an evaluation snapshot to history.
        Keeps last 20 evaluations for trend analysis.
        """
        memory_collection = get_user_memory_collection()
        
        # Create evaluation snapshot
        snapshot = {
            "timestamp": datetime.utcnow(),
            "clarity_score": evaluation.get("clarity_score", 50),
            "confusion_trend": evaluation.get("confusion_trend", "stable"),
            "understanding_delta": evaluation.get("understanding_delta", 0),
            "stagnation_flags": evaluation.get("stagnation_flags", []),
            "engagement_level": evaluation.get("engagement_level", "medium")
        }
        
        # Add to history (push and slice to keep max 20)
        await memory_collection.update_one(
            {"user_id": user_id},
            {
                "$push": {
                    "progress.evaluation_history": {
                        "$each": [snapshot],
                        "$slice": -20  # Keep only last 20
                    }
                },
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
    
    async def update_effort_metrics(self, user_id: str, session_occurred: bool = True):
        """
        Update effort tracking metrics.
        Tracks sessions, consistency streaks, and persistence.
        """
        memory_collection = get_user_memory_collection()
        memory = await memory_collection.find_one({"user_id": user_id})
        
        if not memory:
            return
        
        effort = memory.get("progress", {}).get("effort_metrics", {})
        now = datetime.utcnow()
        last_session = effort.get("last_session_date")
        
        # Calculate consistency streak
        current_streak = effort.get("consistency_streak", 0)
        if last_session:
            if isinstance(last_session, datetime):
                days_since = (now.date() - last_session.date()).days
                if days_since == 1:
                    # Consecutive day
                    current_streak += 1
                elif days_since > 1:
                    # Streak broken
                    current_streak = 1
                # Same day - streak unchanged
            else:
                current_streak = 1
        else:
            current_streak = 1
        
        # Update effort metrics
        update_ops = {
            "$inc": {"progress.effort_metrics.total_sessions": 1 if session_occurred else 0},
            "$set": {
                "progress.effort_metrics.consistency_streak": current_streak,
                "progress.effort_metrics.last_session_date": now,
                "updated_at": now
            }
        }
        
        if session_occurred:
            update_ops["$push"] = {
                "progress.session_dates": {
                    "$each": [now],
                    "$slice": -100  # Keep last 100 sessions
                }
            }
        
        await memory_collection.update_one(
            {"user_id": user_id},
            update_ops
        )
    
    async def update_learner_traits(self, user_id: str):
        """
        Analyze evaluation history to update long-term learner traits.
        Derives perseverance and frustration tolerance from patterns.
        """
        memory_collection = get_user_memory_collection()
        memory = await memory_collection.find_one({"user_id": user_id})
        
        if not memory:
            return
        
        eval_history = memory.get("progress", {}).get("evaluation_history", [])
        effort = memory.get("progress", {}).get("effort_metrics", {})
        
        if len(eval_history) < 5:
            return  # Need enough data
        
        # Calculate perseverance: high effort despite low clarity = high perseverance
        total_sessions = effort.get("total_sessions", 0)
        avg_clarity = sum(e.get("clarity_score", 50) for e in eval_history[-10:]) / min(10, len(eval_history))
        
        if total_sessions > 10 and avg_clarity < 40:
            perseverance = "high"  # Lots of effort despite struggle
        elif total_sessions > 5:
            perseverance = "moderate"
        else:
            perseverance = "low"
        
        # Calculate frustration tolerance: how often do they continue after worsening trend?
        worsening_count = sum(1 for e in eval_history if e.get("confusion_trend") == "worsening")
        if worsening_count > 3 and total_sessions > worsening_count * 2:
            frustration_tolerance = "high"  # Continues despite frustration
        elif worsening_count > 2:
            frustration_tolerance = "moderate"
        else:
            frustration_tolerance = "moderate"
        
        await memory_collection.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "profile.perseverance": perseverance,
                    "profile.frustration_tolerance": frustration_tolerance,
                    "updated_at": datetime.utcnow()
                }
            }
        )

