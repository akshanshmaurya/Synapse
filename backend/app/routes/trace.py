from fastapi import APIRouter, Depends, Query
from typing import List, Dict, Any
from app.services.trace_service import trace_service

router = APIRouter(prefix="/api/traces", tags=["system-traces"])

@router.get("/", response_model=List[Dict[str, Any]])
async def get_traces(limit: int = Query(20, ge=1, le=100)):
    """
    Get recent system traces for the Cognitive Activity Panel.
    """
    return await trace_service.get_recent_traces(limit)
