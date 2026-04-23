"""
System Traces Route — Cognitive Activity Panel

Authorization: Authenticated users only (data isolation via user_id filter).
For admin-only mode, swap get_current_user → require_admin from
app.core.authorization (RBAC).

Security: Each user can only retrieve their own traces — the user_id filter
in get_recent_traces ensures data isolation at the query level.
"""
from fastapi import APIRouter, Depends, Query  # type: ignore
from typing import List, Dict, Any
from app.services.trace_service import trace_service  # type: ignore
from app.auth.dependencies import get_current_user  # type: ignore

router = APIRouter(prefix="/api/traces", tags=["system-traces"])


# Authorization: authenticated user required (own traces only)
@router.get("/", response_model=List[Dict[str, Any]])
async def get_traces(
    current_user: dict = Depends(get_current_user),
    limit: int = Query(30, ge=1, le=100),
    session_id: str | None = Query(None),
):
    """
    Get recent system traces for the Cognitive Activity Panel.
    
    Authorization: Authenticated users only. Each user can only retrieve
    their own traces — the user_id filter ensures data isolation.
    For admin access to all traces, use Depends(require_admin) from
    app.core.authorization.
    
    Limit raised to 30 (was 20) so the full pipeline per message is visible.
    """
    return await trace_service.get_recent_traces(
        limit=limit,
        user_id=str(current_user["_id"]),
        session_id=session_id,
    )
