"""
Trace Service
Structured cognitive trace logging for the AI agent pipeline.

Each trace answers:
  - What was the agent given? (input_summary)
  - What did it decide? (decision)
  - Why did it decide that? (reasoning)
  - What came out? (output_summary)
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
import uuid
from app.db.mongodb import get_database  # type: ignore


class TraceService:
    def __init__(self):
        """Internal helper."""
        pass

    async def add_trace(
        self,
        request_id: str,
        agent: str,
        action: str,
        details: Dict[str, Any],
        # Rich observability fields
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        input_summary: Optional[str] = None,
        decision: Optional[str] = None,
        reasoning: Optional[str] = None,
        output_summary: Optional[str] = None,
    ):
        """
        Log a structured system trace.

        Required:
            request_id  — ties all traces in one request together
            agent       — which agent produced this trace
            action      — short label for what happened

        Observability fields (preferred for rich traces):
            input_summary  — what the agent received / what context it had
            decision       — the decision or strategy chosen
            reasoning      — why that decision was made
            output_summary — what the agent produced
        """
        trace = {
            "trace_id": str(uuid.uuid4()),
            "request_id": request_id,
            "agent": agent,
            "action": action,
            # Identifiers
            "user_id": user_id,
            "session_id": session_id,
            # Observability
            "input_summary": input_summary,
            "decision": decision,
            "reasoning": reasoning,
            "output_summary": output_summary,
            # Legacy flat details (for backward compatibility with UI)
            "details": details,
            "timestamp": datetime.utcnow(),
        }

        db = get_database()
        if db is not None:
            await db["system_traces"].insert_one(trace)

    async def get_recent_traces(
        self, 
        limit: int = 20, 
        user_id: Optional[str] = None, 
        session_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get most recent traces for the Cognitive Activity Panel UI.
        """
        db = get_database()
        if db is None:
            return []

        query = {}
        if user_id:
            query["user_id"] = user_id
        if session_id:
            query["session_id"] = session_id

        cursor = db["system_traces"].find(query).sort("timestamp", -1).limit(limit)
        traces = await cursor.to_list(length=limit)

        for t in traces:
            t["_id"] = str(t["_id"])
            # Ensure UTC "Z" suffix so frontend converts to local time correctly
            ts = t["timestamp"].isoformat()
            if not ts.endswith("Z"):
                ts += "Z"
            t["timestamp"] = ts

        return traces


# Singleton instance
trace_service = TraceService()
