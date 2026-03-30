"""
Learning Analytics Endpoint — Phase 4
Aggregates evaluator history into time-series data for frontend charts.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timedelta
from app.auth.dependencies import get_current_user
from app.db.mongodb import get_user_memory_collection, MongoDB
from app.utils.logger import logger

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/learning")
async def get_learning_analytics(user_id: str = Depends(get_current_user)):
    """
    Returns aggregated learning analytics for the authenticated user.

    Response includes:
    - clarity_trend: List of {date, score} over time
    - confusion_trend: List of {date, trend} over time
    - pace_history: Current and recent learning pace changes
    - session_activity: Sessions per day over the last 30 days
    - summary: Current metrics snapshot
    """
    try:
        memory_collection = get_user_memory_collection()
        memory = await memory_collection.find_one({"user_id": user_id})

        if not memory:
            return _empty_analytics()

        # Extract evaluation history
        progress = memory.get("progress", {})
        eval_history = progress.get("evaluation_history", [])
        interactions = memory.get("interactions", [])

        # Build clarity trend (last 30 evaluations)
        clarity_trend = []
        confusion_data = []
        for i, ev in enumerate(eval_history[-30:]):
            entry_date = ev.get("timestamp", "")
            if not entry_date and i < len(interactions):
                entry_date = interactions[i].get("timestamp", "")
            clarity_trend.append({
                "index": i,
                "date": str(entry_date)[:10] if entry_date else f"Session {i + 1}",
                "score": ev.get("clarity_score", 50),
            })
            confusion_data.append({
                "index": i,
                "date": str(entry_date)[:10] if entry_date else f"Session {i + 1}",
                "trend": ev.get("confusion_trend", "stable"),
            })

        # Session activity (from interactions)
        session_activity = _compute_session_activity(interactions)

        # Struggles summary
        struggles = memory.get("struggles", [])
        struggle_summary = []
        for s in struggles[-10:]:
            struggle_summary.append({
                "topic": s.get("topic", "unknown"),
                "severity": s.get("severity", "mild"),
                "count": s.get("occurrence_count", 1),
            })

        # Current snapshot
        profile = memory.get("profile", {})
        latest_eval = eval_history[-1] if eval_history else {}
        summary = {
            "current_clarity": latest_eval.get("clarity_score", 50),
            "current_trend": latest_eval.get("confusion_trend", "stable"),
            "learning_pace": profile.get("learning_pace", "moderate"),
            "stage": profile.get("stage", "seedling"),
            "total_sessions": len(interactions),
            "total_evaluations": len(eval_history),
            "roadmap_regenerations": progress.get("roadmap_regeneration_count", 0),
        }

        return {
            "clarity_trend": clarity_trend,
            "confusion_trend": confusion_data,
            "session_activity": session_activity,
            "struggles": struggle_summary,
            "summary": summary,
        }

    except Exception as e:
        logger.error("Analytics error: %s", e)
        return _empty_analytics()


def _compute_session_activity(interactions: list) -> list:
    """Compute sessions per day for the last 30 days."""
    day_counts = {}
    for interaction in interactions:
        ts = interaction.get("timestamp", "")
        if ts:
            try:
                if isinstance(ts, str):
                    day = ts[:10]
                else:
                    day = str(ts)[:10]
                day_counts[day] = day_counts.get(day, 0) + 1
            except Exception as e:
                logger.warning("Error parsing timestamp in session metrics: %s", e)
                continue

    # Fill in the last 30 days
    today = datetime.utcnow().date()
    activity = []
    for i in range(29, -1, -1):
        d = today - timedelta(days=i)
        ds = d.isoformat()
        activity.append({
            "date": ds,
            "sessions": day_counts.get(ds, 0),
        })
    return activity


def _empty_analytics() -> dict:
    """Return empty analytics structure."""
    return {
        "clarity_trend": [],
        "confusion_trend": [],
        "session_activity": [],
        "struggles": [],
        "summary": {
            "current_clarity": 50,
            "current_trend": "stable",
            "learning_pace": "moderate",
            "stage": "seedling",
            "total_sessions": 0,
            "total_evaluations": 0,
            "roadmap_regenerations": 0,
        },
    }

# ─── Phase 5.4C: Three-Layer Dashboard Endpoints ─────────────────────────────

from app.services.dashboard_service import DashboardService

_dashboard_service = DashboardService()


@router.get("/concept-map")
async def get_concept_map(user_id: str = Depends(get_current_user)):
    """
    Returns domain-grouped concept mastery with ZPD flags.
    Phase 5.4C — reads from ConceptMemory and prerequisite graph.
    """
    try:
        insights = await _dashboard_service.get_dashboard_insights_v2(user_id)
        return insights.get("concept_map", {"domains": {}, "status": "no_data"})
    except Exception as e:
        logger.error("Concept map error: %s", e)
        return {"domains": {}, "status": "error"}


@router.get("/recommendations")
async def get_recommendations(user_id: str = Depends(get_current_user)):
    """
    Returns ZPD-based recommendations for what to learn next.
    Phase 5.4C — uses prerequisite graph + ConceptMemory mastery.
    """
    try:
        insights = await _dashboard_service.get_dashboard_insights_v2(user_id)
        return {
            "next_steps": insights.get("next_steps", []),
            "velocity": insights.get("velocity", {}),
        }
    except Exception as e:
        logger.error("Recommendations error: %s", e)
        return {"next_steps": [], "velocity": {}}
