"""
Learning Pattern Service

Analyzes user learning history across sessions to synthesize higher-level insights 
and structural patterns. It detects learning velocity and struggle categories 
that per-concept scores miss.

Rooted in Vygotsky's Zone of Proximal Development (1978), this service helps 
identify whether a learner is struggling due to missing foundational prerequisites 
(Zone 3 - too hard), or simply needs more practice within their current ZPD.
"""

import logging
import time
from typing import Dict, Any, List, Optional
from collections import defaultdict

from app.models.memory_v2 import UserConceptMemory, SessionContext
from app.services.concept_memory_service import concept_memory_service
from app.services.session_context_service import session_context_service
from app.knowledge.prerequisite_graph import PREREQUISITE_GRAPH, get_all_prerequisites, get_prerequisites

logger = logging.getLogger(__name__)

class LearningPatternService:
    async def analyze_learning_velocity(self, user_id: str) -> Dict[str, Any]:
        """
        Calculates how FAST the user is learning across concepts.
        Analyzes mastery_history for concepts with 3+ history entries to compute velocity.
        """
        start_time = time.time()
        
        user_memory = await concept_memory_service.get_user_concepts(user_id)
        if not user_memory or not getattr(user_memory, "concepts", None):
            return {"status": "insufficient_data"}
            
        concepts = user_memory.concepts
        
        # Check if user has at least 3 concepts tracked overall
        if len(concepts) < 3:
            return {"status": "insufficient_data"}
            
        fast_concepts = []
        steady_concepts = []
        slow_concepts = []
        regressing_concepts = []
        
        domain_velocities = defaultdict(list)
        all_velocities = []

        for cid, record in concepts.items():
            history = record.mastery_history
            if not history or len(history) < 3:
                continue
                
            # Number of unique sessions, or simply entries - 1
            # Assuming each history entry represents a session's end update
            num_sessions = len(history) - 1
            
            earliest_mastery = history[0].score
            latest_mastery = history[-1].score
            
            velocity = (latest_mastery - earliest_mastery) / max(1, num_sessions)
            all_velocities.append(velocity)
            domain_velocities[record.domain].append(velocity)
            
            if velocity > 0.1:
                fast_concepts.append(cid)
            elif velocity >= 0.03:
                steady_concepts.append(cid)
            elif velocity >= 0:
                slow_concepts.append(cid)
            else:
                regressing_concepts.append(cid)
                
        if not all_velocities:
            # Not enough history on individual concepts yet
            return {"status": "insufficient_data"}

        avg_velocity = sum(all_velocities) / len(all_velocities)
        
        overall_status = "slow"
        if avg_velocity > 0.1:
            overall_status = "fast"
        elif avg_velocity >= 0.03:
            overall_status = "steady"
        elif avg_velocity < 0:
            overall_status = "regressing"
            
        velocity_by_domain = {
            dom: round(sum(vels) / len(vels), 3)
            for dom, vels in domain_velocities.items()
        }
        
        logger.info(f"Analyzed learning velocity for user {user_id} in {time.time() - start_time:.3f}s")
        
        return {
            "status": "success",
            "overall_velocity": overall_status,
            "fast_concepts": fast_concepts,
            "steady_concepts": steady_concepts,
            "slow_concepts": slow_concepts,
            "regressing_concepts": regressing_concepts,
            "velocity_by_domain": velocity_by_domain
        }

    async def detect_struggle_patterns(self, user_id: str) -> Dict[str, Any]:
        """
        Finds patterns in what the user struggles with.
        Uses deterministic rules based on the prerequisite graph and mastery thresholds.
        """
        start_time = time.time()
        
        user_memory = await concept_memory_service.get_user_concepts(user_id)
        if not user_memory or not getattr(user_memory, "concepts", None):
            return {"patterns": [], "primary_struggle_type": None, "learning_style_signal": None}
            
        concepts = user_memory.concepts
        patterns = []
        
        # Helper structures
        low_mastery_concepts = {cid: rec for cid, rec in concepts.items() if rec.mastery_level < 0.3}
        mid_mastery_concepts = {cid: rec for cid, rec in concepts.items() if 0.2 <= rec.mastery_level <= 0.5}
        high_mastery_concepts = {cid: rec for cid, rec in concepts.items() if rec.mastery_level >= 0.6}
        
        # 1. Conceptual Gaps: 2+ concepts in the same prerequisite chain with < 0.3 mastery
        # Find roots. A root is a low mastery concept that is a prerequisite to another low mastery concept.
        foundational_gaps = set()
        for cid, record in low_mastery_concepts.items():
            if cid not in PREREQUISITE_GRAPH:
                continue
                
            all_prereqs = get_all_prerequisites(cid)
            # Find which of these prerequisites are also low mastery
            low_prereqs = [p for p in all_prereqs if p in low_mastery_concepts]
            if low_prereqs:
                # The lowest level prereq in this list is the real root gap
                # To simplify, we group by the low_prereqs
                for lp in low_prereqs:
                    foundational_gaps.add(lp)
        
        if foundational_gaps:
            for gap_root in foundational_gaps:
                affected = [cid for cid, rec in low_mastery_concepts.items() if gap_root in get_all_prerequisites(cid)]
                patterns.append({
                    "type": "conceptual_gap",
                    "description": f"Foundational gap in {gap_root} affecting dependent concepts",
                    "root_concept": gap_root,
                    "affected_concepts": affected,
                    "recommendation": f"Revisit {gap_root} to fix foundational misunderstandings"
                })

        # 2. Breadth Without Depth: 5+ concepts 0.2-0.5, none > 0.6
        if len(mid_mastery_concepts) >= 5 and len(high_mastery_concepts) == 0:
            patterns.append({
                "type": "breadth_without_depth",
                "description": f"User has surface knowledge of {len(mid_mastery_concepts)} concepts but hasn't mastered any",
                "affected_concepts": list(mid_mastery_concepts.keys()),
                "recommendation": "Focus on mastering one concept at a time before moving on"
            })

        # 3. Stuck on Prerequisites (Concept itself): Prerequisites met (>0.5), but concept <0.3 after 3+ exposures
        for cid, record in low_mastery_concepts.items():
            if record.exposure_count >= 3 and cid in PREREQUISITE_GRAPH:
                prereqs = get_prerequisites(cid)
                if not prereqs:
                    continue
                # Check if all prereqs are met
                prereqs_met = all(
                    concepts.get(p) and concepts[p].mastery_level >= 0.5 
                    for p in prereqs
                )
                if prereqs_met:
                    patterns.append({
                        "type": "stuck_on_concept",
                        "description": f"Prerequisites met, but struggling with {cid} after {record.exposure_count} exposures",
                        "affected_concepts": [cid],
                        "recommendation": f"Try a different teaching approach or analogy for {cid}"
                    })

        # 4. Domain Imbalance
        domain_avg = defaultdict(list)
        for cid, record in concepts.items():
            domain_avg[record.domain].append(record.mastery_level)
            
        domain_scores = {dom: sum(scores)/len(scores) for dom, scores in domain_avg.items()}
        domains = list(domain_scores.keys())
        for i in range(len(domains)):
            for j in range(i+1, len(domains)):
                d1, d2 = domains[i], domains[j]
                if abs(domain_scores[d1] - domain_scores[d2]) > 0.3:
                    higher, lower = (d1, d2) if domain_scores[d1] > domain_scores[d2] else (d2, d1)
                    patterns.append({
                        "type": "domain_imbalance",
                        "description": f"Significant imbalance: {higher} ({domain_scores[higher]:.2f}) vs {lower} ({domain_scores[lower]:.2f})",
                        "affected_domains": [higher, lower],
                        "recommendation": f"Leverage {higher} analogies to explain {lower} concepts"
                    })

        primary_struggle_type = None
        learning_style_signal = None
        
        if patterns:
            # Prioritise conceptual gaps as highest urgency
            gap_patterns = [p for p in patterns if p["type"] == "conceptual_gap"]
            if gap_patterns:
                primary_struggle_type = "conceptual_gap"
                learning_style_signal = "needs_bottom_up_explanation"
            elif any(p["type"] == "stuck_on_concept" for p in patterns):
                primary_struggle_type = "stuck_on_concept"
                learning_style_signal = "needs_more_examples"
            elif any(p["type"] == "breadth_without_depth" for p in patterns):
                primary_struggle_type = "breadth_without_depth"
                learning_style_signal = "needs_focused_practice"
                
        logger.info(f"Detected {len(patterns)} struggle patterns for user {user_id} in {time.time() - start_time:.3f}s")

        return {
            "patterns": patterns,
            "primary_struggle_type": primary_struggle_type,
            "learning_style_signal": learning_style_signal
        }

    async def generate_learning_profile_update(self, user_id: str) -> Dict[str, Any]:
        """
        Synthesizes velocity + patterns into profile updates (strengths, weaknesses, styles).
        Returns the update dictionary but does not write to DB.
        """
        velocity_data = await self.analyze_learning_velocity(user_id)
        pattern_data = await self.detect_struggle_patterns(user_id)
        
        user_memory = await concept_memory_service.get_user_concepts(user_id)
        if not user_memory:
            return {}
            
        concepts = user_memory.concepts
        
        suggested_strengths = set()
        suggested_weaknesses = set()
        
        # Analyze Strengths from velocity
        if velocity_data.get("status") == "success":
            for domain, vels in velocity_data.get("velocity_by_domain", {}).items():
                if vels > 0.05:
                    # Verify >= 3 fast concepts in this domain
                    fast_in_domain = [cid for cid in velocity_data.get("fast_concepts", []) if concepts.get(cid) and concepts[cid].domain == domain]
                    if len(fast_in_domain) >= 3:
                        suggested_strengths.add(domain)

        # Analyze Weaknesses from patterns
        # We consider a pattern "persistent" if it relies on concepts with 3+ exposures.
        # Concept gaps are a strong signal of weakness if they affect 3+ elements
        for pattern in pattern_data.get("patterns", []):
            if pattern["type"] == "conceptual_gap":
                root = pattern.get("root_concept")
                if root and concepts.get(root) and concepts[root].exposure_count >= 3:
                    suggested_weaknesses.add(f"foundational_{root}")
            elif pattern["type"] == "stuck_on_concept":
                cid = pattern["affected_concepts"][0]
                if concepts.get(cid) and concepts[cid].exposure_count >= 4:
                    suggested_weaknesses.add(f"application_{cid}")

        learning_style_suggestion = pattern_data.get("learning_style_signal")
        score = 0
        if suggested_strengths:
            score += 0.3
        if suggested_weaknesses:
            score += 0.4
        if learning_style_suggestion:
            score += 0.3

        reasoning = []
        if suggested_strengths:
            reasoning.append(f"Fast learning velocity established in: {', '.join(suggested_strengths)}.")
        if suggested_weaknesses:
            reasoning.append(f"Persistent struggle patterns detected requiring intervention: {', '.join(suggested_weaknesses)}.")
            
        return {
            "suggested_strength_additions": list(suggested_strengths),
            "suggested_weakness_additions": list(suggested_weaknesses),
            "learning_style_suggestion": learning_style_suggestion,
            "confidence": min(1.0, score + 0.1),
            "reasoning": " ".join(reasoning) if reasoning else "Not enough distinct pattern data to suggest changes."
        }

    async def get_session_end_summary(self, user_id: str, session_id: str) -> Dict[str, Any]:
        """
        Generates a summary of what happened in this session from a learning perspective.
        Cross-references SessionContext with ConceptMemory changes.
        """
        start_time = time.time()
        
        session = await session_context_service.get_session(session_id, user_id)
        user_memory = await concept_memory_service.get_user_concepts(user_id)
        
        if not session or not user_memory:
            return {"status": "error", "message": "Context or memory not found"}
            
        concepts = user_memory.concepts
        
        concepts_encountered = session.active_concepts
        concepts_improved = []
        concepts_struggled = []
        
        for cid in concepts_encountered:
            if cid not in concepts:
                continue
            record = concepts[cid]
            
            # Find history matching this session
            # Since mastery history tracks session_id, we can isolate it.
            session_history = [s for s in record.mastery_history if s.session_id == session_id]
            
            if session_history:
                # 'after' is the last snapshot in THIS session
                after = session_history[-1].score
                
                # 'before' is the snapshot RIGHT BEFORE this session
                # If there are none from previous sessions, assume 0.0 or the first in this session
                prev_history = [s for s in record.mastery_history if s.session_id != session_id and s.date < session_history[0].date]
                if prev_history:
                    before = prev_history[-1].score
                else:
                    # Concept introduced this session, its "before" is 0.0 effectively, or its first score
                    before = session_history[0].score if len(session_history) > 1 else 0.0
                
                if after >= before + 0.05:
                    concepts_improved.append({
                        "id": cid,
                        "before": round(before, 2),
                        "after": round(after, 2)
                    })
            
            # Check for struggles
            if record.last_clarity_score is not None and record.last_clarity_score < 40:
                concepts_struggled.append({
                    "id": cid,
                    "misconceptions": record.misconceptions
                })
                
        # Calculate effectiveness
        effectiveness = "low"
        if len(concepts_improved) > 0:
            if len(concepts_improved) >= len(concepts_struggled) and len(concepts_improved) >= 2:
                effectiveness = "high"
            else:
                effectiveness = "moderate"
                
        # ZPD check
        # Was the session actually addressing concepts in the user's ZPD?
        zpd_alignment = False
        if session.session_domain:
            # We can't perfectly rewind ZPD, but we can check if the concepts were likely ZPD
            # by looking at if they improved them or if they met prereqs.
            # Simplified: if any active concept has prerequisites met, it's ZPD aligned.
            for cid in concepts_encountered:
                if cid in PREREQUISITE_GRAPH:
                    prereqs = get_prerequisites(cid)
                    if not prereqs or all(concepts.get(p) and concepts[p].mastery_level >= 0.5 for p in prereqs):
                        zpd_alignment = True
                        break
        else:
            # Default fallback
            zpd_alignment = True

        next_suggestion = "Consolidate today's topics with a brief review."
        if concepts_struggled:
            struggle_ids = [s["id"] for s in concepts_struggled]
            next_suggestion = f"Revisit {', '.join(struggle_ids)} focusing on the core misconceptions uncovered."
        elif concepts_improved:
            next_suggestion = f"Move forward to applications of {concepts_improved[0]['id']} or related topics."

        logger.info(f"Generated session end summary for {session_id} in {time.time() - start_time:.3f}s")
        
        return {
            "session_goal": session.session_goal,
            "concepts_encountered": concepts_encountered,
            "concepts_improved": concepts_improved,
            "concepts_struggled": concepts_struggled,
            "session_effectiveness": effectiveness,
            "zpd_alignment": zpd_alignment,
            "next_session_suggestion": next_suggestion
        }

learning_pattern_service = LearningPatternService()
