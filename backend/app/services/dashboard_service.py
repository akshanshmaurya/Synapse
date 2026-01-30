"""
Dashboard Service
Derives display content from raw memory signals.
Does NOT write to memory - only reads and computes.
Enhanced with variety for different user personas.
"""
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import random
from app.db.mongodb import get_user_memory_collection, get_interactions_collection, get_roadmaps_collection

class DashboardService:
    """
    Derives dashboard insights from raw memory signals.
    Separates display logic from memory storage.
    Provides personalized variety based on user traits.
    """
    
    # Message templates for variety - keyed by momentum state
    MOMENTUM_INSIGHTS = {
        "accelerating": [
            "Strong momentum with {sessions} sessions this week and clear understanding.",
            "You're on a roll — {sessions} sessions this week with excellent clarity.",
            "Exceptional pace: {sessions} sessions and high comprehension this week.",
            "Peak performance: {sessions} sessions with strong understanding.",
        ],
        "steady": [
            "Consistent progress: {progress}% through your current pathway.",
            "Steady advancement at {progress}% of your pathway.",
            "Reliable rhythm: {progress}% pathway completion with {sessions} sessions.",
            "On track: {progress}% complete, maintaining good consistency.",
        ],
        "building": [
            "Building rhythm with {sessions} session{s} this week.",
            "Gaining traction: {sessions} session{s} this week.",
            "Momentum developing: {sessions} session{s} logged.",
            "Growing consistency with {sessions} session{s} this week.",
        ],
        "starting": [
            "Ready to begin. Start a session to build momentum.",
            "Your journey awaits. Begin a session when ready.",
            "Fresh start available. Pick up whenever you're ready.",
            "Time to grow. Start a session to track progress.",
        ],
        "returning": [
            "Welcome back after {days} days. Ready to resume?",
            "Good to see you again. It's been {days} days since your last session.",
            "Returning after {days} days. Your pathway is waiting.",
        ],
    }
    
    # Daily nurture prompts - contextual and varied
    NURTURE_PROMPTS = {
        "after_session": [
            "What stood out to you from today's session?",
            "Any insights you want to capture from your session?",
            "What's one thing you learned or realized today?",
        ],
        "struggle_focused": [
            "What's making {topic} challenging right now?",
            "Any new perspectives on {topic} since we last discussed it?",
        ],
        "goal_focused": [
            "How does today's progress connect to your goal of {goal}?",
            "What small step toward {goal} can you take next?",
        ],
        "reflection": [
            "What's on your mind today?",
            "Any thoughts you'd like to process?",
        ],
    }
    
    # Signal observation templates
    SIGNAL_OBSERVATIONS = {
        "recurring_struggle": [
            "Recurring difficulty with {topic} ({count} occurrences)",
            "{topic} continues to be a challenge ({count} times)",
            "Pattern: {topic} needs more attention ({count} occurrences)",
        ],
        "new_topic": [
            "First time exploring {topic}",
            "New territory: {topic}",
            "Started learning about {topic}",
        ],
        "milestone": [
            "Reached {count} total sessions",
            "Milestone: {count} sessions completed",
            "{count} sessions logged — steady progress",
        ],
        "clarity_positive": [
            "Clarity reached more often than confusion ({clarity} vs {confusion})",
            "Understanding improving: {clarity} clarity moments vs {confusion} confusion",
            "Positive trend: clarity ({clarity}) outpacing confusion ({confusion})",
        ],
        "detailed_questions": [
            "Detailed and thoughtful questions in recent sessions",
            "Engaging deeply with topics in recent conversations",
            "Asking increasingly specific questions",
        ],
        "consistency": [
            "Consistent engagement over the past week",
            "Regular session pattern emerging",
            "Building a steady learning routine",
        ],
        "improving_pace": [
            "Sessions becoming more focused",
            "Covering more ground per session",
            "Efficiency improving in recent sessions",
        ],
    }
    
    async def get_dashboard_insights(self, user_id: str) -> Dict[str, Any]:
        """
        Main entry point - returns all dashboard data for a user.
        """
        memory_collection = get_user_memory_collection()
        memory = await memory_collection.find_one({"user_id": user_id})
        
        if not memory:
            return self._empty_dashboard()
        
        # Get roadmap data
        roadmap_collection = get_roadmaps_collection()
        roadmap = await roadmap_collection.find_one({
            "user_id": user_id,
            "is_active": True
        })
        
        # Get recent interactions
        interactions_collection = get_interactions_collection()
        recent_interactions = await interactions_collection.find(
            {"user_id": user_id}
        ).sort("created_at", -1).limit(20).to_list(length=20)
        
        # Derive all sections
        progress = memory.get("progress", {})
        profile = memory.get("profile", {})
        struggles = memory.get("struggles", [])
        onboarding = memory.get("onboarding", {})
        
        momentum = self._derive_momentum(progress, roadmap, profile)
        next_bloom = self._derive_next_bloom(roadmap, profile)
        recent_signals = self._derive_recent_signals(struggles, recent_interactions, progress, profile)
        daily_nurture = self._derive_daily_nurture(progress, recent_interactions, struggles, profile)
        
        return {
            "momentum": momentum,
            "next_bloom": next_bloom,
            "recent_signals": recent_signals,
            "show_daily_nurture": daily_nurture["show"],
            "daily_nurture_prompt": daily_nurture["prompt"]
        }
    
    def _empty_dashboard(self) -> Dict[str, Any]:
        """Return empty dashboard for new users"""
        return {
            "momentum": {
                "state": "starting",
                "insight": random.choice(self.MOMENTUM_INSIGHTS["starting"]),
                "metrics": {
                    "sessions_this_week": 0,
                    "roadmap_progress": 0,
                    "clarity_trend": "moderate"
                }
            },
            "next_bloom": None,
            "recent_signals": [],
            "show_daily_nurture": False,
            "daily_nurture_prompt": None
        }
    
    def _derive_momentum(self, progress: Dict, roadmap: Optional[Dict], profile: Dict) -> Dict[str, Any]:
        """
        Derive momentum state from raw signals.
        Uses range-based logic with personalized messaging.
        """
        now = datetime.utcnow()
        week_ago = now - timedelta(days=7)
        
        # Calculate sessions in last 7 days
        session_dates = progress.get("session_dates", [])
        sessions_this_week = sum(
            1 for d in session_dates 
            if isinstance(d, datetime) and d >= week_ago
        )
        
        # Calculate days since last session
        last_session = progress.get("last_session")
        days_since_session = None
        if isinstance(last_session, datetime):
            days_since_session = (now - last_session).days
        
        # Calculate roadmap progress
        roadmap_progress = 0
        if roadmap:
            total_steps = roadmap.get("total_steps", 0)
            completed_steps = roadmap.get("completed_steps", 0)
            if total_steps > 0:
                roadmap_progress = int((completed_steps / total_steps) * 100)
        
        # Calculate clarity trend
        confusion_count = progress.get("confusion_count", 0)
        clarity_count = progress.get("clarity_reached_count", 0)
        total_interactions = progress.get("total_interactions", 0)
        
        if total_interactions == 0:
            clarity_trend = "moderate"
        elif clarity_count >= confusion_count:
            clarity_trend = "high"
        elif confusion_count > clarity_count * 2:
            clarity_trend = "low"
        else:
            clarity_trend = "moderate"
        
        # Determine momentum state with returning user detection
        if days_since_session and days_since_session > 7 and sessions_this_week == 0:
            state = "returning"
            template = random.choice(self.MOMENTUM_INSIGHTS.get("returning", self.MOMENTUM_INSIGHTS["starting"]))
            insight = template.format(days=days_since_session)
        elif sessions_this_week >= 5 and clarity_trend == "high":
            state = "accelerating"
            template = random.choice(self.MOMENTUM_INSIGHTS["accelerating"])
            insight = template.format(sessions=sessions_this_week)
        elif sessions_this_week >= 3 and roadmap_progress > 30:
            state = "steady"
            template = random.choice(self.MOMENTUM_INSIGHTS["steady"])
            insight = template.format(progress=roadmap_progress, sessions=sessions_this_week)
        elif sessions_this_week >= 1:
            state = "building"
            template = random.choice(self.MOMENTUM_INSIGHTS["building"])
            insight = template.format(
                sessions=sessions_this_week, 
                s="s" if sessions_this_week > 1 else ""
            )
        else:
            state = "starting"
            insight = random.choice(self.MOMENTUM_INSIGHTS["starting"])
        
        # Adjust insight based on learning pace preference
        learning_pace = profile.get("learning_pace", "moderate")
        if learning_pace == "fast" and state in ["building", "steady"]:
            insight += " Keep pushing forward."
        elif learning_pace == "slow" and state in ["building", "steady"]:
            insight += " Take your time."
        
        return {
            "state": state if state != "returning" else "starting",  # Map returning to starting for frontend
            "insight": insight,
            "metrics": {
                "sessions_this_week": sessions_this_week,
                "roadmap_progress": roadmap_progress,
                "clarity_trend": clarity_trend
            }
        }
    
    def _derive_next_bloom(self, roadmap: Optional[Dict], profile: Dict) -> Optional[Dict[str, Any]]:
        """
        Derive next growth area from roadmap or inferred goals.
        Must be specific and actionable.
        """
        if roadmap and roadmap.get("stages"):
            stages = roadmap.get("stages", [])
            
            # Find first non-completed stage with pending steps
            for stage in stages:
                for step in stage.get("steps", []):
                    status = step.get("status", "pending")
                    if status not in ["completed", "done"]:
                        step_type = step.get("step_type", "learn")
                        description = step.get("description") or f"Next step in: {stage.get('name', 'Your Pathway')}"
                        
                        # Add action hint based on step type
                        action_hints = {
                            "learn": "Focus on understanding",
                            "practice": "Apply what you've learned",
                            "build": "Create something tangible",
                            "reflect": "Think deeply about your progress",
                            "milestone": "A checkpoint to celebrate"
                        }
                        
                        return {
                            "title": step.get("title", "Continue your pathway"),
                            "description": description,
                            "action_hint": action_hints.get(step_type, ""),
                            "source": "roadmap"
                        }
            
            # All steps done
            return {
                "title": "Pathway Complete",
                "description": "Consider setting a new goal to continue growing.",
                "action_hint": "Time to define your next challenge",
                "source": "roadmap"
            }
        
        # No roadmap - infer from goals
        goals = profile.get("goals", [])
        if goals:
            return {
                "title": goals[0],
                "description": "Create a pathway to make progress on this goal.",
                "action_hint": "Define your steps forward",
                "source": "inferred"
            }
        
        # No goals - suggest based on interests
        interests = profile.get("interests", [])
        if interests:
            return {
                "title": f"Explore {interests[0]}",
                "description": "Start a session to discuss your interests and set a goal.",
                "action_hint": "Talk to your mentor",
                "source": "inferred"
            }
        
        return None
    
    def _derive_recent_signals(
        self, 
        struggles: List[Dict], 
        interactions: List[Dict],
        progress: Dict,
        profile: Dict
    ) -> List[Dict[str, Any]]:
        """
        Derive recent observed signals - patterns, not praise.
        These are observations, not encouragement.
        Enhanced with more variety and pattern detection.
        """
        signals = []
        now = datetime.utcnow()
        
        # Check for struggle patterns
        recent_struggles = sorted(
            struggles, 
            key=lambda s: s.get("last_seen", datetime.min),
            reverse=True
        )[:3]
        
        for struggle in recent_struggles:
            count = struggle.get("count", 1)
            topic = struggle.get("topic", "a topic")
            last_seen = struggle.get("last_seen")
            severity = struggle.get("severity", "mild")
            
            if count >= 3:
                template = random.choice(self.SIGNAL_OBSERVATIONS["recurring_struggle"])
                signals.append({
                    "observation": template.format(topic=topic, count=count),
                    "timestamp": last_seen.isoformat() if isinstance(last_seen, datetime) else str(last_seen),
                    "type": "struggle",
                    "severity": severity
                })
            elif count == 1 and last_seen:
                # Only show if it's recent (within last 7 days)
                if isinstance(last_seen, datetime) and (now - last_seen).days <= 7:
                    template = random.choice(self.SIGNAL_OBSERVATIONS["new_topic"])
                    signals.append({
                        "observation": template.format(topic=topic),
                        "timestamp": last_seen.isoformat(),
                        "type": "pattern"
                    })
        
        # Check for session milestones
        total_sessions = progress.get("total_sessions", 0)
        if total_sessions > 0 and total_sessions % 5 == 0:
            template = random.choice(self.SIGNAL_OBSERVATIONS["milestone"])
            signals.append({
                "observation": template.format(count=total_sessions),
                "timestamp": now.isoformat(),
                "type": "progress"
            })
        
        # Check for clarity improvements
        clarity_count = progress.get("clarity_reached_count", 0)
        confusion_count = progress.get("confusion_count", 0)
        if clarity_count > confusion_count and clarity_count > 2:
            template = random.choice(self.SIGNAL_OBSERVATIONS["clarity_positive"])
            signals.append({
                "observation": template.format(clarity=clarity_count, confusion=confusion_count),
                "timestamp": now.isoformat(),
                "type": "progress"
            })
        
        # Check interaction patterns
        if len(interactions) >= 5:
            # Look for increasing engagement (detailed questions)
            avg_length = sum(len(i.get("user_message", "")) for i in interactions[:5]) / 5
            if avg_length > 100:
                template = random.choice(self.SIGNAL_OBSERVATIONS["detailed_questions"])
                signals.append({
                    "observation": template,
                    "timestamp": interactions[0].get("created_at", now).isoformat() if interactions else now.isoformat(),
                    "type": "pattern"
                })
            
            # Check for consistency pattern
            session_dates = progress.get("session_dates", [])
            week_ago = now - timedelta(days=7)
            recent_sessions = [d for d in session_dates if isinstance(d, datetime) and d >= week_ago]
            
            if len(recent_sessions) >= 3:
                # Check if sessions are spread across days (not all on one day)
                unique_days = len(set(d.date() for d in recent_sessions))
                if unique_days >= 3:
                    template = random.choice(self.SIGNAL_OBSERVATIONS["consistency"])
                    signals.append({
                        "observation": template,
                        "timestamp": now.isoformat(),
                        "type": "progress"
                    })
        
        # Add confidence trend signal if applicable
        confidence_trend = profile.get("confidence_trend", "stable")
        if confidence_trend == "growing":
            signals.append({
                "observation": "Confidence appears to be growing based on recent interactions",
                "timestamp": now.isoformat(),
                "type": "progress"
            })
        elif confidence_trend == "declining":
            signals.append({
                "observation": "You may benefit from revisiting foundational concepts",
                "timestamp": now.isoformat(),
                "type": "pattern"
            })
        
        # Deduplicate and limit
        seen = set()
        unique_signals = []
        for signal in signals:
            key = signal["observation"][:50]  # Use first 50 chars as key
            if key not in seen:
                seen.add(key)
                unique_signals.append(signal)
        
        return unique_signals[:5]  # Limit to 5 signals
    
    def _derive_daily_nurture(
        self, 
        progress: Dict, 
        interactions: List[Dict],
        struggles: List[Dict],
        profile: Dict
    ) -> Dict[str, Any]:
        """
        Determine if daily nurture prompt should be shown.
        Contextual and personalized based on activity.
        """
        last_session = progress.get("last_session")
        
        if not last_session:
            return {"show": False, "prompt": None}
        
        # Only show if there was a session today
        now = datetime.utcnow()
        if isinstance(last_session, datetime):
            session_today = last_session.date() == now.date()
        else:
            session_today = False
        
        if not session_today:
            return {"show": False, "prompt": None}
        
        # Generate contextual prompt based on recent activity
        
        # If there's a recent struggle, ask about it
        if struggles:
            recent_struggle = max(
                struggles, 
                key=lambda s: s.get("last_seen", datetime.min) if isinstance(s.get("last_seen"), datetime) else datetime.min
            )
            if isinstance(recent_struggle.get("last_seen"), datetime):
                if (now - recent_struggle["last_seen"]).days <= 1:
                    topic = recent_struggle.get("topic", "the topic")
                    template = random.choice(self.NURTURE_PROMPTS["struggle_focused"])
                    return {
                        "show": True,
                        "prompt": template.format(topic=topic)
                    }
        
        # If user has goals, connect to them occasionally
        goals = profile.get("goals", [])
        if goals and random.random() < 0.3:  # 30% chance to ask goal-focused
            template = random.choice(self.NURTURE_PROMPTS["goal_focused"])
            return {
                "show": True,
                "prompt": template.format(goal=goals[0])
            }
        
        # Default: ask about today's session
        if interactions:
            template = random.choice(self.NURTURE_PROMPTS["after_session"])
            return {
                "show": True,
                "prompt": template
            }
        
        return {"show": False, "prompt": None}
