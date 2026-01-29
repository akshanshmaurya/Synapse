"""
Onboarding API Routes
Handles new user onboarding flow
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.auth.dependencies import get_current_user
from app.db.mongodb import get_user_memory_collection

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])

class OnboardingData(BaseModel):
    """Onboarding form data"""
    why_here: str
    guidance_type: str
    experience_level: str
    mentoring_style: str

class OnboardingStatus(BaseModel):
    """Response for onboarding status"""
    is_complete: bool
    onboarding: Optional[dict] = None

@router.get("/status")
async def get_onboarding_status(current_user: dict = Depends(get_current_user)):
    """Check if user has completed onboarding"""
    user_id = str(current_user["_id"])
    memory_collection = get_user_memory_collection()
    
    memory = await memory_collection.find_one({"user_id": user_id})
    
    if not memory:
        return {"is_complete": False, "onboarding": None}
    
    onboarding = memory.get("onboarding", {})
    return {
        "is_complete": onboarding.get("is_complete", False),
        "onboarding": onboarding if onboarding.get("is_complete") else None
    }

@router.post("/complete")
async def complete_onboarding(
    data: OnboardingData,
    current_user: dict = Depends(get_current_user)
):
    """Complete the onboarding process"""
    user_id = str(current_user["_id"])
    memory_collection = get_user_memory_collection()
    
    onboarding_doc = {
        "is_complete": True,
        "why_here": data.why_here,
        "guidance_type": data.guidance_type,
        "experience_level": data.experience_level,
        "mentoring_style": data.mentoring_style,
        "completed_at": datetime.utcnow()
    }
    
    # Update or create memory document
    result = await memory_collection.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "onboarding": onboarding_doc,
                "profile.learning_pace": "slow" if data.experience_level == "beginner" else "moderate" if data.experience_level == "intermediate" else "fast",
                "updated_at": datetime.utcnow()
            }
        },
        upsert=True
    )
    
    return {
        "success": True,
        "message": "Welcome! Your journey begins now.",
        "onboarding": onboarding_doc
    }

@router.get("/questions")
async def get_onboarding_questions():
    """Get the onboarding questions structure"""
    return {
        "questions": [
            {
                "id": "why_here",
                "question": "What brings you here today?",
                "type": "textarea",
                "placeholder": "Share what you're hoping to achieve...",
                "required": True
            },
            {
                "id": "guidance_type",
                "question": "What type of guidance are you looking for?",
                "type": "select",
                "options": [
                    {"value": "career", "label": "Career growth & direction"},
                    {"value": "skills", "label": "Learning new skills"},
                    {"value": "goals", "label": "Setting and achieving goals"},
                    {"value": "confidence", "label": "Building confidence"},
                    {"value": "balance", "label": "Finding balance & clarity"}
                ],
                "required": True
            },
            {
                "id": "experience_level",
                "question": "How would you describe your current experience level?",
                "type": "select",
                "options": [
                    {"value": "beginner", "label": "Just starting out"},
                    {"value": "intermediate", "label": "Some experience"},
                    {"value": "advanced", "label": "Experienced, seeking mastery"}
                ],
                "required": True
            },
            {
                "id": "mentoring_style",
                "question": "What kind of mentoring feels right for you?",
                "type": "select",
                "options": [
                    {"value": "gentle", "label": "Gentle and patient"},
                    {"value": "supportive", "label": "Warm and encouraging"},
                    {"value": "direct", "label": "Clear and straightforward"},
                    {"value": "challenging", "label": "Pushes me to grow"}
                ],
                "required": True
            }
        ]
    }
