"""
System Traces Route
Protected by admin role — only admins can see system traces.
"""
from fastapi import APIRouter, Depends, Query
from typing import List, Dict, Any
from app.services.trace_service import trace_service
from app.auth.dependencies import require_role

router = APIRouter(prefix="/api/traces", tags=["system-traces"])


@router.get("/", response_model=List[Dict[str, Any]])
async def get_traces(
    current_user: dict = Depends(require_role("admin")),
    limit: int = Query(20, ge=1, le=100),
):
    """
    Get recent system traces for the Cognitive Activity Panel.
    Requires admin role.
    """
    return await trace_service.get_recent_traces(limit)
