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
        effort = self._derive_effort_display(progress)  # NEW: Separate effort display
        next_bloom = self._derive_next_bloom(roadmap, profile)
        recent_signals = self._derive_recent_signals(struggles, recent_interactions, progress, profile)
        daily_nurture = self._derive_daily_nurture(progress, recent_interactions, struggles, profile)
        
        return {
            "momentum": momentum,
            "effort": effort,  # NEW: Effort section (separate from momentum)
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
                    "clarity_score": 0,
                    "understanding_trend": "stable",
                    "understanding_delta": 0,
                    "evaluation_count": 0
                }
            },
            "effort": {
                "sessions_this_week": 0,
                "total_sessions": 0,
                "consistency_streak": 0,
                "persistence_label": "New",
                "note": "Effort reflects activity, not understanding."
            },
            "next_bloom": None,
            "recent_signals": [],
            "show_daily_nurture": False,
            "daily_nurture_prompt": None
        }
    
    def _derive_momentum(self, progress: Dict, roadmap: Optional[Dict], profile: Dict) -> Dict[str, Any]:
        """
        Derive momentum from EVALUATOR outputs, not session counts.
        Momentum = understanding quality, not effort.
        
        This is the critical change: momentum reflects comprehension,
        not how much time/effort the user is spending.
        """
        evaluation_history = progress.get("evaluation_history", [])
        effort_metrics = progress.get("effort_metrics", {})
        
        # If no evaluations yet, show starting state
        if not evaluation_history:
            return self._starting_momentum()
        
        # Get recent evaluations (last 5)
        recent = evaluation_history[-5:]
        
        # Calculate average clarity score (0-100)
        avg_clarity = sum(e.get("clarity_score", 50) for e in recent) / len(recent)
        
        # Get latest confusion trend
        latest = recent[-1] if recent else {}
        confusion_trend = latest.get("confusion_trend", "stable")
        understanding_delta = latest.get("understanding_delta", 0)
        
        # Classify momentum based on UNDERSTANDING, not activity
        if avg_clarity >= 70 and confusion_trend == "improving":
            state = "accelerating"
        elif avg_clarity >= 50 and confusion_trend != "worsening":
            state = "steady"
        elif avg_clarity >= 30 or confusion_trend == "improving":
            state = "building"
        else:
            state = "struggling"  # Honest about lack of progress
        
        # Generate TRUTHFUL insight (not motivational)
        insight = self._generate_truthful_insight(
            state, avg_clarity, confusion_trend, understanding_delta, effort_metrics
        )
        
        return {
            "state": state,
            "insight": insight,
            "metrics": {
                "clarity_score": int(avg_clarity),
                "understanding_trend": confusion_trend,
                "understanding_delta": understanding_delta,
                "evaluation_count": len(evaluation_history)
            }
        }
    
    def _starting_momentum(self) -> Dict[str, Any]:
        """Return starting momentum for new users with no evaluations"""
        return {
            "state": "starting",
            "insight": random.choice(self.MOMENTUM_INSIGHTS["starting"]),
            "metrics": {
                "clarity_score": 0,
                "understanding_trend": "stable",
                "understanding_delta": 0,
                "evaluation_count": 0
            }
        }
    
    def _generate_truthful_insight(
        self, 
        state: str, 
        clarity: float, 
        confusion_trend: str,
        understanding_delta: int,
        effort_metrics: Dict
    ) -> str:
        """
        Generate honest, non-exaggerated insight.
        Honesty > motivation.
        """
        sessions = effort_metrics.get("total_sessions", 0)
        streak = effort_metrics.get("consistency_streak", 0)
        
        # High effort + low clarity = hardworking but stuck
        if sessions > 5 and clarity < 40:
            return f"High effort with {sessions} sessions, but clarity remains challenging at {int(clarity)}%. Consider revisiting fundamentals or trying a different approach."
        
        # High effort + high clarity = efficient
        if sessions > 5 and clarity >= 70:
            return f"Strong understanding ({int(clarity)}% clarity) with consistent {sessions} sessions. Your effort is translating to comprehension."
        
        # Low effort + high clarity = efficient learner
        if sessions <= 3 and clarity >= 60:
            return f"Efficient learning: {int(clarity)}% clarity achieved with minimal sessions. Quality over quantity."
        
        # Improving trend
        if confusion_trend == "improving" and understanding_delta > 0:
            return f"Clarity improving (+{understanding_delta} points). The concepts are becoming clearer."
        
        # Worsening trend - be honest
        if confusion_trend == "worsening":
            return f"Understanding appears to be declining. Current clarity: {int(clarity)}%. This is normal - consider slowing down."
        
        # Stable/building
        if state == "building":
            return f"Building understanding: {int(clarity)}% clarity. Progress is gradual but present."
        
        # Default steady
        return f"Steady progress at {int(clarity)}% clarity. Understanding is {confusion_trend}."
    
    def _derive_effort_display(self, progress: Dict) -> Dict[str, Any]:
        """
        Derive effort metrics for separate display (not conflated with momentum).
        This shows activity metrics honestly, without implying they equal progress.
        """
        effort = progress.get("effort_metrics", {})
        session_dates = progress.get("session_dates", [])
        now = datetime.utcnow()
        week_ago = now - timedelta(days=7)
        
        # Calculate sessions in last 7 days
        sessions_this_week = sum(
            1 for d in session_dates 
            if isinstance(d, datetime) and d >= week_ago
        )
        
        return {
            "sessions_this_week": sessions_this_week,
            "total_sessions": effort.get("total_sessions", 0),
            "consistency_streak": effort.get("consistency_streak", 0),
            "persistence_label": self._get_effort_label(effort),
            "note": "Effort reflects activity, not understanding."
        }
    
    def _get_effort_label(self, effort: Dict) -> str:
        """Get a factual effort description"""
        sessions = effort.get("total_sessions", 0)
        streak = effort.get("consistency_streak", 0)
        
        if streak >= 7:
            return "Highly consistent"
        elif streak >= 3:
            return "Building consistency"
        elif sessions >= 10:
            return "Active"
        elif sessions >= 3:
            return "Getting started"
        else:
            return "New"
    
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
