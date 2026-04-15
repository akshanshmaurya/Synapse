"""
System Traces Route
Protected by admin role — only admins can see system traces.
"""
from fastapi import APIRouter, Depends, Query  # type: ignore
from typing import List, Dict, Any
from app.services.trace_service import trace_service  # type: ignore
from app.core.authorization import require_admin  # type: ignore

router = APIRouter(prefix="/api/traces", tags=["system-traces"])


@router.get("/", response_model=List[Dict[str, Any]])
async def get_traces(
    current_user: dict = Depends(require_admin),
    limit: int = Query(20, ge=1, le=100),
    session_id: str | None = Query(None),
):
    """
    Get recent system traces for the Cognitive Activity Panel.
    Requires user authentication.
    """
    return await trace_service.get_recent_traces(
        limit=limit, 
        user_id=str(current_user["_id"]), 
        session_id=session_id
    )
