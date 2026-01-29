"""
Roadmap API Routes
"""
from fastapi import APIRouter, HTTPException, status, Depends
from typing import Optional
from datetime import datetime
from bson import ObjectId

from app.models.roadmap import (
    Roadmap, RoadmapStage, RoadmapStep, StepStatus,
    RoadmapGenerateRequest, StepFeedbackRequest, RoadmapFeedback
)
from app.db.mongodb import get_roadmaps_collection, get_roadmap_feedback_collection, get_user_memory_collection
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/roadmap", tags=["roadmap"])

@router.get("/current")
async def get_current_roadmap(current_user: dict = Depends(get_current_user)):
    """
    Get the user's current active roadmap.
    Returns pure nested JSON for direct frontend rendering.
    """
    user_id = str(current_user["_id"])
    roadmaps = get_roadmaps_collection()
    
    # Get most recent active roadmap
    roadmap = await roadmaps.find_one(
        {"user_id": user_id, "is_active": True},
        sort=[("created_at", -1)]
    )
    
    if not roadmap:
        return {"roadmap": None, "message": "No roadmap found. Start by sharing your goals with your mentor."}
    
    roadmap["_id"] = str(roadmap["_id"])
    return {"roadmap": roadmap}

@router.get("/history")
async def get_roadmap_history(current_user: dict = Depends(get_current_user)):
    """Get all archived roadmaps for the user (is_active = false)"""
    user_id = str(current_user["_id"])
    roadmaps = get_roadmaps_collection()
    
    cursor = roadmaps.find(
        {"user_id": user_id, "is_active": False}
    ).sort("created_at", -1)
    
    history = await cursor.to_list(length=20)
    
    for r in history:
        r["_id"] = str(r["_id"])
    
    return {"history": history}

@router.post("/generate")
async def generate_roadmap(
    request: RoadmapGenerateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate a new roadmap based on user's goal.
    Returns pure nested JSON designed for direct frontend rendering.
    """
    user_id = str(current_user["_id"])
    
    # Archive any existing active roadmaps
    roadmaps = get_roadmaps_collection()
    await roadmaps.update_many(
        {"user_id": user_id, "is_active": True},
        {"$set": {"is_active": False, "archived_at": datetime.utcnow()}}
    )
    
    # Import executor agent for roadmap generation
    from app.agents.executor_agent import ExecutorAgent
    executor = ExecutorAgent()
    
    # Generate roadmap (returns frontend-ready JSON)
    roadmap_data = await executor.generate_roadmap(user_id, request.goal, request.context)
    
    if not roadmap_data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate roadmap"
        )
    
    # Store complete nested JSON document
    roadmap_doc = {
        "user_id": user_id,
        "title": roadmap_data.get("title", f"Pathway to {request.goal}"),
        "goal": request.goal,
        # Nested stages with steps - NOT flattened
        "stages": roadmap_data.get("stages", []),
        # Metadata
        "total_steps": roadmap_data.get("total_steps", 0),
        "completed_steps": 0,
        # Version control
        "version": 1,
        "previous_version_id": None,
        # Status
        "is_active": True,
        "archived_at": None,
        # Timestamps
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await roadmaps.insert_one(roadmap_doc)
    roadmap_doc["_id"] = str(result.inserted_id)
    
    # Update user memory with current roadmap
    memory_collection = get_user_memory_collection()
    await memory_collection.update_one(
        {"user_id": user_id},
        {"$set": {"progress.current_roadmap_id": str(result.inserted_id)}}
    )
    
    return {"roadmap": roadmap_doc}

@router.post("/feedback")
async def submit_step_feedback(
    roadmap_id: str,
    request: StepFeedbackRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Submit feedback on a roadmap step (stuck, needs help, not clear).
    Stores feedback both per-step in the roadmap AND in feedback collection for history.
    """
    user_id = str(current_user["_id"])
    
    roadmaps = get_roadmaps_collection()
    feedback_collection = get_roadmap_feedback_collection()
    
    # Verify roadmap belongs to user
    roadmap = await roadmaps.find_one({
        "_id": ObjectId(roadmap_id),
        "user_id": user_id
    })
    
    if not roadmap:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roadmap not found"
        )
    
    # Create feedback record
    feedback_record = {
        "feedback_type": request.feedback_type.value,
        "message": request.message,
        "created_at": datetime.utcnow().isoformat()
    }
    
    # Update step in roadmap: status AND append to user_feedback array
    updated = False
    stage_id = None
    for stage in roadmap.get("stages", []):
        for step in stage.get("steps", []):
            if step.get("id") == request.step_id:
                step["status"] = request.feedback_type.value
                # Append feedback to step's user_feedback array
                if "user_feedback" not in step:
                    step["user_feedback"] = []
                step["user_feedback"].append(feedback_record)
                stage_id = stage.get("id")
                updated = True
                break
        if updated:
            break
    
    if updated:
        await roadmaps.update_one(
            {"_id": ObjectId(roadmap_id)},
            {
                "$set": {
                    "stages": roadmap["stages"],
                    "updated_at": datetime.utcnow()
                }
            }
        )
    
    # Also store in feedback collection for history preservation
    feedback_doc = {
        "user_id": user_id,
        "roadmap_id": roadmap_id,
        "roadmap_version": roadmap.get("version", 1),
        "stage_id": stage_id,
        "step_id": request.step_id,
        "feedback_type": request.feedback_type.value,
        "message": request.message,
        "created_at": datetime.utcnow()
    }
    await feedback_collection.insert_one(feedback_doc)
    
    return {
        "success": True,
        "message": "Your feedback has been noted. The roadmap may be adjusted to better support you."
    }

@router.post("/regenerate")
async def regenerate_roadmap(
    roadmap_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Regenerate roadmap based on accumulated feedback"""
    user_id = str(current_user["_id"])
    
    roadmaps = get_roadmaps_collection()
    feedback_collection = get_roadmap_feedback_collection()
    memory_collection = get_user_memory_collection()
    
    # Get current roadmap
    old_roadmap = await roadmaps.find_one({
        "_id": ObjectId(roadmap_id),
        "user_id": user_id
    })
    
    if not old_roadmap:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roadmap not found"
        )
    
    # Get all feedback for this roadmap
    feedback_cursor = feedback_collection.find({"roadmap_id": roadmap_id})
    feedback_list = await feedback_cursor.to_list(length=50)
    
    # Get user memory for evaluator
    memory = await memory_collection.find_one({"user_id": user_id})
    
    # Use evaluator to analyze feedback and update memory
    from app.agents.evaluator_agent import EvaluatorAgent
    evaluator = EvaluatorAgent()
    
    analysis = evaluator.analyze_roadmap_feedback(feedback_list, memory or {})
    await evaluator.update_memory_from_roadmap_feedback(user_id, analysis)
    
    # Archive old roadmap (is_active = false)
    await roadmaps.update_one(
        {"_id": ObjectId(roadmap_id)},
        {"$set": {"is_active": False, "archived_at": datetime.utcnow()}}
    )
    
    # Use executor to regenerate with analysis context
    from app.agents.executor_agent import ExecutorAgent
    executor = ExecutorAgent()
    
    new_roadmap_data = await executor.regenerate_roadmap(
        user_id,
        old_roadmap,
        feedback_list,
        analysis  # Pass evaluator analysis
    )
    
    if not new_roadmap_data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to regenerate roadmap"
        )
    
    # Create new version
    new_version = old_roadmap.get("version", 1) + 1
    new_roadmap_doc = {
        "user_id": user_id,
        "title": new_roadmap_data.get("title", old_roadmap["title"]),
        "goal": old_roadmap["goal"],
        "stages": new_roadmap_data.get("stages", []),
        "version": new_version,
        "previous_version_id": roadmap_id,
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await roadmaps.insert_one(new_roadmap_doc)
    new_roadmap_doc["_id"] = str(result.inserted_id)
    
    # Update user memory with new roadmap
    await memory_collection.update_one(
        {"user_id": user_id},
        {"$set": {"progress.current_roadmap_id": str(result.inserted_id)}}
    )
    
    return {
        "roadmap": new_roadmap_doc,
        "message": "Your pathway has been adapted based on your feedback."
    }

@router.put("/step/{roadmap_id}/{step_id}/complete")
async def mark_step_complete(
    roadmap_id: str,
    step_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark a step as complete"""
    user_id = str(current_user["_id"])
    roadmaps = get_roadmaps_collection()
    
    roadmap = await roadmaps.find_one({
        "_id": ObjectId(roadmap_id),
        "user_id": user_id
    })
    
    if not roadmap:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roadmap not found"
        )
    
    # Update step status
    updated = False
    for stage in roadmap.get("stages", []):
        for step in stage.get("steps", []):
            if step.get("id") == step_id:
                step["status"] = "completed"
                step["completed_at"] = datetime.utcnow().isoformat()
                updated = True
                break
        if updated:
            break
    
    if updated:
        await roadmaps.update_one(
            {"_id": ObjectId(roadmap_id)},
            {
                "$set": {
                    "stages": roadmap["stages"],
                    "updated_at": datetime.utcnow()
                }
            }
        )
    
    return {"success": True, "message": "Step marked as complete. Well done!"}
