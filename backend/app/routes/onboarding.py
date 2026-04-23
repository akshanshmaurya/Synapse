"""
Onboarding API Routes
Handles new user onboarding flow
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime

from app.auth.dependencies import get_current_user
from app.db.mongodb import get_user_memory_collection
from app.utils.sanitizer import sanitize_text  # XSS prevention

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])

class OnboardingData(BaseModel):
    """Onboarding form data — validated with Literal types"""
    why_here: str = Field(..., min_length=1, max_length=2000)
    guidance_type: Literal["career", "skills", "goals", "confidence", "balance"]
    experience_level: Literal["beginner", "intermediate", "advanced"]
    mentoring_style: Literal["gentle", "supportive", "direct", "challenging"]

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
    """
    Complete the onboarding process.

    Dual-write strategy (migration period):
      1. Write to legacy user_memory collection (existing behavior, unchanged)
      2. Write to new user_profiles collection via ProfileService (Phase 4.7)

    If the ProfileService write fails, the legacy write still succeeds.
    This ensures zero downtime during migration.

    Wizard-to-profile field mapping:
      experience_level   -> experience_level       (direct pass-through)
      mentoring_style    -> mentoring_tone          (gentle/supportive -> supportive,
                                                     direct -> balanced,
                                                     challenging -> challenging)
      guidance_type      -> career_interests        (career -> [career-growth],
                                                     skills -> [skill-building], etc.)
      (not captured yet) -> preferred_learning_style (defaults to "mixed")
      (not captured yet) -> age_group               (Phase 5 wizard expansion)
      (not captured yet) -> education_level          (Phase 5 wizard expansion)
    """
    user_id = str(current_user["_id"])
    memory_collection = get_user_memory_collection()

    # XSS sanitization: strip HTML from free-text field before storage
    sanitized_why_here = sanitize_text(data.why_here)

    onboarding_doc = {
        "is_complete": True,
        "why_here": sanitized_why_here,
        "guidance_type": data.guidance_type,
        "experience_level": data.experience_level,
        "mentoring_style": data.mentoring_style,
        "completed_at": datetime.utcnow()
    }

    # --- Write 1: Legacy user_memory (UNCHANGED — keep during migration) ---
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

    # --- Write 2: New UserProfileV2 via ProfileService (Phase 4.7) ---
    # ProfileService.update_from_onboarding() handles the field mapping internally
    # (see profile_service.py _TONE_MAP and _GUIDANCE_TO_INTERESTS).
    try:
        from app.services.profile_service import profile_service
        from app.utils.logger import logger

        await profile_service.update_from_onboarding(
            user_id=user_id,
            data={
                "experience_level": data.experience_level,
                "mentoring_style": data.mentoring_style,
                "guidance_type": data.guidance_type,
            },
        )
        logger.debug("ProfileService dual-write succeeded for user=%s", user_id)
    except Exception as e:
        # Non-blocking: legacy write already succeeded above.
        # Log the error so we can track migration reliability.
        import logging
        logging.getLogger(__name__).error(
            "ProfileService dual-write failed for user=%s (legacy still OK): %s",
            user_id, e,
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
