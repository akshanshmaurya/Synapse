from typing import Dict, Any, List, Optional
from datetime import datetime
import uuid
from app.db.mongodb import get_database

class TraceService:
    def __init__(self):
        pass

    async def add_trace(self, request_id: str, agent: str, action: str, details: Dict[str, Any]):
        """
        Log a system trace.
        """
        trace = {
            "trace_id": str(uuid.uuid4()),
            "request_id": request_id,
            "agent": agent,
            "action": action,
            "details": details,
            "timestamp": datetime.utcnow()
        }
        
        db = get_database()
        if db is not None:
             await db["system_traces"].insert_one(trace)
    
    async def get_recent_traces(self, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Get most recent traces for the UI.
        """
        db = get_database()
        if db is None:
            return []
            
        cursor = db["system_traces"].find().sort("timestamp", -1).limit(limit)
        traces = await cursor.to_list(length=limit)
        
        # formatting for frontend
        for t in traces:
            t["_id"] = str(t["_id"])
            t["timestamp"] = t["timestamp"].isoformat()
            
        return traces

# Singleton instance
trace_service = TraceService()
