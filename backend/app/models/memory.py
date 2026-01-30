"""
User Memory Model for MongoDB
Stores onboarding, profile, struggles, and progress
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class Onboarding(BaseModel):
    """Onboarding data - MANDATORY before mentor access"""
    is_complete: bool = False
    why_here: Optional[str] = None  # Why the user is here
    guidance_type: Optional[str] = None  # What type of guidance they want
    experience_level: Optional[str] = None  # beginner, intermediate, advanced
    mentoring_style: Optional[str] = None  # gentle, direct, challenging, supportive
    completed_at: Optional[datetime] = None

class Struggle(BaseModel):
    """Record of a topic the user struggles with"""
    topic: str
    count: int = 1
    severity: str = "mild"  # mild, moderate, significant
    last_seen: datetime = Field(default_factory=datetime.utcnow)
    notes: Optional[str] = None

class Milestone(BaseModel):
    """Achievement or milestone reached"""
    id: str
    title: str
    achieved_at: datetime = Field(default_factory=datetime.utcnow)
    context: Optional[str] = None

class UserProfile(BaseModel):
    """User profile within memory"""
    interests: List[str] = []
    goals: List[str] = []
    stage: str = "seedling"  # seedling, growing, branching, flourishing
    communication_style: Optional[str] = None
    learning_preferences: Optional[List[str]] = None
    learning_pace: str = "moderate"  # slow, moderate, fast
    # Inferred traits (derived over time)
    abstraction_level: str = "moderate"  # concrete, moderate, abstract
    autonomy: str = "guided"  # guided, semi-autonomous, self-directed
    confidence_trend: str = "stable"  # declining, stable, growing

class UserProgress(BaseModel):
    """User progress tracking"""
    total_sessions: int = 0
    total_interactions: int = 0
    milestones: List[Milestone] = []
    current_roadmap_id: Optional[str] = None
    last_session: Optional[datetime] = None
    roadmap_regeneration_count: int = 0  # Track how many times roadmap was regenerated
    # Session tracking for consistency calculation
    session_dates: List[datetime] = []
    # Clarity/confusion tracking
    confusion_count: int = 0
    clarity_reached_count: int = 0
    time_to_clarity_avg: float = 0.0  # Average messages until confusion resolves

class UserMemory(BaseModel):
    """Complete user memory document"""
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    onboarding: Onboarding = Field(default_factory=Onboarding)  # NEW: Onboarding data
    profile: UserProfile = Field(default_factory=UserProfile)
    struggles: List[Struggle] = []
    progress: UserProgress = Field(default_factory=UserProgress)
    context_summary: Optional[str] = None  # AI-generated summary for context
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True

class Interaction(BaseModel):
    """Single interaction record"""
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    session_id: str
    user_message: str
    mentor_response: str
    planner_strategy: Optional[Dict[str, Any]] = None
    evaluator_insights: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True
