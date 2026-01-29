"""
Roadmap Model for MongoDB
Designed for direct frontend rendering - pure nested JSON structure
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class StepStatus(str, Enum):
    """Step status for UI rendering"""
    PENDING = "pending"
    ACTIVE = "active"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    STUCK = "stuck"
    NEEDS_HELP = "needs_help"
    NOT_CLEAR = "not_clear"
    FLAGGED = "flagged"

class StepType(str, Enum):
    """Step type for UI hints"""
    LEARN = "learn"
    PRACTICE = "practice"
    BUILD = "build"
    REFLECT = "reflect"
    MILESTONE = "milestone"

class StepFeedback(BaseModel):
    """User feedback attached to a step"""
    feedback_type: str
    message: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UIHints(BaseModel):
    """Optional UI metadata for rendering"""
    color: Optional[str] = None  # hex color
    icon: Optional[str] = None   # icon name
    priority: Optional[str] = None  # low, medium, high
    estimated_time: Optional[str] = None  # e.g., "30 mins", "2 hours"

class RoadmapStep(BaseModel):
    """
    Single step in a roadmap stage.
    Designed for direct frontend rendering with JS event attachment.
    """
    id: str  # Unique ID for event binding
    title: str
    description: Optional[str] = None
    status: StepStatus = StepStatus.PENDING
    step_type: StepType = StepType.LEARN
    resources: Optional[List[str]] = None
    
    # UI metadata
    ui_hints: Optional[UIHints] = None
    
    # User feedback history (per step)
    user_feedback: Optional[List[StepFeedback]] = []
    
    # Timestamps
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

class RoadmapStage(BaseModel):
    """
    Stage containing multiple steps.
    Nested structure - NOT flattened.
    """
    id: str  # Unique ID for event binding
    name: str
    description: Optional[str] = None
    status: StepStatus = StepStatus.PENDING
    order: int = 0  # For rendering order
    
    # Nested steps - NOT flattened
    steps: List[RoadmapStep] = []
    
    # UI metadata
    ui_hints: Optional[UIHints] = None

class Roadmap(BaseModel):
    """
    Full roadmap document - pure JSON for frontend rendering.
    
    Frontend can:
    - Render directly from this JSON
    - Attach JS events to steps using IDs
    - Re-render seamlessly on regeneration
    """
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    title: str
    goal: str
    
    # Nested stages with steps - NEVER FLATTEN
    stages: List[RoadmapStage] = []
    
    # Version control
    version: int = 1
    previous_version_id: Optional[str] = None  # Link to archived version
    
    # Status
    is_active: bool = True  # False = archived
    archived_at: Optional[datetime] = None
    
    # Metadata
    total_steps: int = 0
    completed_steps: int = 0
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True

class RoadmapFeedback(BaseModel):
    """
    Standalone feedback record (for history preservation).
    Also stored per-step in the roadmap, but kept here for history.
    """
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    roadmap_id: str
    roadmap_version: int = 1
    step_id: str
    stage_id: Optional[str] = None
    feedback_type: str
    message: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True

class RoadmapGenerateRequest(BaseModel):
    """Request to generate a new roadmap"""
    goal: str
    context: Optional[str] = None
    preferred_pace: Optional[str] = None  # slow, moderate, fast

class StepFeedbackRequest(BaseModel):
    """Request to mark a step with feedback"""
    step_id: str
    feedback_type: StepStatus
    message: Optional[str] = None
