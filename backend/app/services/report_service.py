"""
Report Service
Aggregates signal data from across all memory layers and collections to
generate a comprehensive learning outcome report for the user.

Cognitive science rationale:
    Surfacing learning outcomes serves as a meta-cognitive reflection tool.
    By making the invisible progress markers (concept mastery, clarity trends,
    trajectory) visible to the user, we reinforce their mental model of their
    own learning journey (metacognition).
"""

import logging
from datetime import datetime
from typing import Dict, Any, List

from app.db.mongodb import (
    get_user_profiles_collection,
    get_concept_memory_collection,
    get_user_memory_collection,
    get_roadmaps_collection
)

logger = logging.getLogger(__name__)

class ReportService:
    """
    Orchestrates the assembly of learning reports.
    Pure aggregation - no LLM calls to ensure deterministic accuracy.
    """

    async def generate_report(self, user_id: str) -> Dict[str, Any]:
        """
        Assemble a structured report from all memory layers.

        Args:
            user_id: The learner ID.

        Returns:
            A structured dict containing profile, concepts, stats, and roadmap progress.
        """
        # 1. Profile Data (Layer 1)
        profile_col = get_user_profiles_collection()
        profile_doc = await profile_col.find_one({"user_id": user_id}) or {}

        # 2. Concept Data (Layer 2)
        concept_col = get_concept_memory_collection()
        concept_doc = await concept_col.find_one({"user_id": user_id}) or {}
        concepts_dict = concept_doc.get("concepts", {})
        
        all_concepts = list(concepts_dict.values())
        total_concepts = len(all_concepts)
        
        # Sort concepts by mastery
        sorted_concepts = sorted(all_concepts, key=lambda x: x.get("mastery_level", 0.0), reverse=True)
        top_5 = sorted_concepts[:5]
        
        # Bottom 3 (needs work) - only if they have been seen (exposure > 0)
        # Exposure count is already >= 1 for anything in the dict usually
        bottom_3 = sorted(all_concepts, key=lambda x: x.get("mastery_level", 0.0))[:3]
        
        domains = list(set(c.get("domain") for c in all_concepts if c.get("domain")))

        # 3. Stats & Trends (Legacy User Memory / Effort metrics)
        memory_col = get_user_memory_collection()
        memory_doc = await memory_col.find_one({"user_id": user_id}) or {}
        
        progress = memory_doc.get("progress", {})
        effort = progress.get("effort_metrics", {})
        eval_history = progress.get("evaluation_history", [])
        
        # Clarity trend direction
        clarity_trend = "stable"
        if len(eval_history) >= 2:
            recent_clarity = [e.get("clarity_score", 0) for e in eval_history[-5:]]
            avg_recent = sum(recent_clarity) / len(recent_clarity)
            
            prev_clarity = [e.get("clarity_score", 0) for e in eval_history[:-5][-5:]] if len(eval_history) > 5 else [eval_history[0].get("clarity_score", 0)]
            avg_prev = sum(prev_clarity) / len(prev_clarity)
            
            if avg_recent > avg_prev + 5:
                clarity_trend = "improving"
            elif avg_recent < avg_prev - 5:
                clarity_trend = "declining"

        # 4. Roadmap Data
        roadmap_col = get_roadmaps_collection()
        # Finished count (where status is completed or similar)
        # According to dashboard_service, roadmaps have 'is_active' and 'stages'
        # We'll just count total roadmaps and get the latest.
        total_roadmaps = await roadmap_col.count_documents({"user_id": user_id})
        
        latest_roadmap = await roadmap_col.find_one(
            {"user_id": user_id},
            sort=[("created_at", -1)]
        )

        # Assemble the report
        report = {
            "generated_at": datetime.utcnow().isoformat(),
            "profile": {
                "experience_level": profile_doc.get("experience_level", "beginner"),
                "career_interests": profile_doc.get("career_interests", []),
                "mentoring_tone": profile_doc.get("mentoring_tone", "balanced"),
            },
            "concepts": {
                "total_tracked": total_concepts,
                "top_mastery": [
                    {
                        "name": c.get("concept_name"),
                        "mastery": round(c.get("mastery_level", 0.0) * 100, 1),
                        "domain": c.get("domain")
                    } for c in top_5
                ],
                "needs_work": [
                    {
                        "name": c.get("concept_name"),
                        "mastery": round(c.get("mastery_level", 0.0) * 100, 1),
                        "domain": c.get("domain")
                    } for c in bottom_3
                ],
                "domains_covered": domains
            },
            "learning_stats": {
                "total_sessions": effort.get("total_sessions", 0),
                "consistency_streak": effort.get("consistency_streak", 0),
                "clarity_trend": clarity_trend,
                "total_evaluations": len(eval_history)
            },
            "roadmap_progress": {
                "total_roadmaps": total_roadmaps,
                "latest_roadmap_title": latest_roadmap.get("title") if latest_roadmap else "No roadmaps created yet"
            }
        }

        logger.info("Generated learning report for user=%s", user_id)
        return report

report_service = ReportService()
