"""
Concept Memory Service
Manages Layer 2 (Knowledge Map) of the Phase 4.7 three-layer memory architecture.

Cognitive science rationale:
    ConceptMemory models *semantic memory* — the structured, long-term store of
    what a learner knows about specific topics. Unlike working memory (Layer 3),
    which resets each session, concept knowledge persists and evolves across all
    conversations.

    Each concept tracked here is analogous to a *schema* in Piaget's theory:
    a mental structure that strengthens with successful retrieval, weakens with
    disuse, and can be disrupted by misconceptions.

Mastery formula:
    mastery = (0.6 * clarity_factor) + (0.3 * exposure_factor) + (0.1 * recency_factor)

    - clarity_factor  = latest_clarity / 100
      Understanding is the dominant signal. A user who scored 90/100 clarity on
      recursion has stronger mastery than one who has seen it 10 times at 30/100.

    - exposure_factor = min(exposure_count, 10) / 10
      Repeated practice builds mastery, but with diminishing returns (capped at
      10). This models the *practice effect* from learning science.

    - recency_factor  = 1.0 if seen within 7 days, then -0.1 per additional week
      Knowledge decays without review. This is a simplified Ebbinghaus forgetting
      curve — the original exponential decay is approximated as a linear step
      function for computational simplicity and interpretability.

    The formula is fully deterministic — no LLM calls, no randomness.
"""

import logging
import re
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

from app.db.mongodb import get_concept_memory_collection
from app.models.memory_v2 import UserConceptMemory, ConceptRecord, MasterySnapshot
from app.knowledge.prerequisite_graph import PREREQUISITE_GRAPH

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_SLUG_RE = re.compile(r"[^a-z0-9-]")
_MULTI_HYPHEN_RE = re.compile(r"-{2,}")
_SPACE_RE = re.compile(r"\s+")

_REJECTED_CONCEPT_SLUGS = {
    "improving",
    "improvement",
    "growth",
    "growing",
    "learning",
    "understanding",
    "knowledge",
    "development",
    "self-development",
    "self-improvement",
    "progress",
    "practice",
    "coding",
    "programming",
    "skill",
    "skills",
}

_CANONICAL_TECH_CONCEPTS = {
    "system-design": ("System Design", "system_design"),
    "software-engineering": ("Software Engineering", "professional_skills"),
    "web-development": ("Web Development", "web"),
    "backend-development": ("Backend Development", "web"),
    "frontend-development": ("Frontend Development", "web"),
    "api-design": ("API Design", "system_design"),
    "rest-api": ("REST API", "system_design"),
    "machine-learning": ("Machine Learning", "ml"),
    "deep-learning": ("Deep Learning", "ml"),
    "artificial-intelligence": ("Artificial Intelligence", "ml"),
    "python": ("Python", "python"),
    "javascript": ("JavaScript", "web"),
    "typescript": ("TypeScript", "web"),
    "react": ("React", "web"),
    "django": ("Django", "python"),
    "fastapi": ("FastAPI", "python"),
    "flask": ("Flask", "python"),
    "data-structures": ("Data Structures", "dsa"),
    "algorithms": ("Algorithms", "dsa"),
}

_PROFESSIONAL_SKILL_CONCEPTS = {
    "communication": "Communication",
    "technical-communication": "Technical Communication",
    "interview-preparation": "Interview Preparation",
    "resume-writing": "Resume Writing",
    "career-planning": "Career Planning",
    "presentation-skills": "Presentation Skills",
    "collaboration": "Collaboration",
    "ai-engineer": "AI Engineer",
    "software-engineer": "Software Engineer",
}

_CONCEPT_ALIASES = {
    "system design": "system-design",
    "software development": "software-engineering",
    "software engineering": "software-engineering",
    "web dev": "web-development",
    "backend": "backend-development",
    "frontend": "frontend-development",
    "rest api": "rest-api",
    "api": "api-design",
    "ml": "machine-learning",
    "machine learning": "machine-learning",
    "deep learning": "deep-learning",
    "ai": "artificial-intelligence",
    "artificial intelligence": "artificial-intelligence",
    "javascript": "javascript",
    "typescript": "typescript",
    "reactjs": "react",
    "react js": "react",
    "data structures": "data-structures",
    "algorithms": "algorithms",
    "interview prep": "interview-preparation",
    "technical interview": "interview-preparation",
    "resume": "resume-writing",
    "communication skills": "communication",
    "technical communication": "technical-communication",
    "ai engineer": "ai-engineer",
    "software engineer": "software-engineer",
}

_DOMAIN_SIGNAL_KEYWORDS = {
    "python": {"python", "django", "fastapi", "flask", "pandas", "numpy"},
    "web": {"web", "frontend", "backend", "react", "javascript", "typescript", "css", "html"},
    "ml": {"ml", "machine learning", "deep learning", "neural", "model", "dataset", "training", "ai"},
    "dsa": {"array", "linked list", "tree", "graph", "recursion", "algorithm", "data structure"},
    "system_design": {"system design", "api", "database", "scalability", "architecture", "distributed", "cache"},
    "professional_skills": {"interview", "resume", "communication", "presentation", "career", "collaboration"},
}


def slugify_concept(name: str) -> str:
    """
    Convert a concept name to a URL-safe, MongoDB-key-safe slug.

    Examples:
        "Binary Search"  -> "binary-search"
        "Two's Complement" -> "twos-complement"
        " DFS / BFS "     -> "dfs-bfs"
    """
    slug = name.lower().strip()
    slug = slug.replace(" ", "-")
    slug = _SLUG_RE.sub("", slug)
    slug = _MULTI_HYPHEN_RE.sub("-", slug)
    return slug.strip("-")


def _prettify_concept_name(slug: str) -> str:
    """Internal helper."""
    return " ".join(part.upper() if len(part) <= 3 else part.capitalize() for part in slug.split("-"))


def _normalize_candidate(name: str) -> tuple[str, str]:
    """Internal helper."""
    cleaned = name.strip().strip(".,:;!?")
    cleaned = cleaned.replace("&", " and ")
    cleaned = cleaned.replace("/", " ")
    cleaned = _SPACE_RE.sub(" ", cleaned)
    lowered = cleaned.lower().strip()
    slug = slugify_concept(lowered)

    alias_slug = _CONCEPT_ALIASES.get(lowered) or _CONCEPT_ALIASES.get(slug)
    if alias_slug:
        slug = alias_slug

    if slug in PREREQUISITE_GRAPH:
        return slug, _prettify_concept_name(slug)
    if slug in _CANONICAL_TECH_CONCEPTS:
        return slug, _CANONICAL_TECH_CONCEPTS[slug][0]
    if slug in _PROFESSIONAL_SKILL_CONCEPTS:
        return slug, _PROFESSIONAL_SKILL_CONCEPTS[slug]

    return slug, _prettify_concept_name(slug)


def _looks_like_supported_concept(name: str, slug: str, session_domain: Optional[str]) -> bool:
    """Internal helper."""
    if not slug or slug in _REJECTED_CONCEPT_SLUGS:
        return False
    if slug.split("-")[0] in _REJECTED_CONCEPT_SLUGS:
        return False
    if slug in PREREQUISITE_GRAPH or slug in _CANONICAL_TECH_CONCEPTS or slug in _PROFESSIONAL_SKILL_CONCEPTS:
        return True

    lowered = name.lower()
    if session_domain and session_domain in _DOMAIN_SIGNAL_KEYWORDS:
        if any(keyword in lowered for keyword in _DOMAIN_SIGNAL_KEYWORDS[session_domain]):
            return True

    for keywords in _DOMAIN_SIGNAL_KEYWORDS.values():
        if any(keyword in lowered for keyword in keywords):
            return True

    return False


def _resolve_concept_domain(name: str, slug: str, session_domain: Optional[str]) -> Optional[str]:
    """Internal helper."""
    if slug in PREREQUISITE_GRAPH:
        return PREREQUISITE_GRAPH[slug]["domain"]
    if slug in _CANONICAL_TECH_CONCEPTS:
        return _CANONICAL_TECH_CONCEPTS[slug][1]
    if slug in _PROFESSIONAL_SKILL_CONCEPTS:
        return "professional_skills"

    lowered = name.lower()
    for domain, keywords in _DOMAIN_SIGNAL_KEYWORDS.items():
        if any(keyword in lowered for keyword in keywords):
            return domain

    if session_domain in {"python", "web", "ml", "dsa", "system_design", "professional_skills"}:
        return session_domain
    if session_domain == "career":
        return "professional_skills"

    return None


def normalize_extracted_concepts(
    concepts: List[str],
    concept_clarity: Optional[Dict[str, Any]] = None,
    misconceptions: Optional[Dict[str, Any]] = None,
    session_domain: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Normalize and filter evaluator-extracted concepts before persistence."""
    concept_clarity = concept_clarity or {}
    misconceptions = misconceptions or {}
    normalized: Dict[str, Dict[str, Any]] = {}

    for raw_name in concepts:
        if not isinstance(raw_name, str) or not raw_name.strip():
            continue

        slug, display_name = _normalize_candidate(raw_name)
        if not _looks_like_supported_concept(display_name, slug, session_domain):
            continue

        domain = _resolve_concept_domain(display_name, slug, session_domain)
        if not domain:
            continue

        raw_clarity = concept_clarity.get(raw_name, concept_clarity.get(display_name))
        if not isinstance(raw_clarity, (int, float)):
            raw_clarity = None

        raw_misconceptions = misconceptions.get(raw_name, misconceptions.get(display_name, []))
        if isinstance(raw_misconceptions, str):
            normalized_misconceptions = [raw_misconceptions] if raw_misconceptions else []
        elif isinstance(raw_misconceptions, list):
            normalized_misconceptions = [
                item for item in raw_misconceptions if isinstance(item, str) and item.strip()
            ]
        else:
            normalized_misconceptions = []

        existing = normalized.get(slug)
        if existing:
            existing["clarity_score"] = max(existing["clarity_score"], raw_clarity or 0.0)
            existing["misconceptions"] = sorted(
                set(existing["misconceptions"]) | set(normalized_misconceptions)
            )
            continue

        normalized[slug] = {
            "concept_id": slug,
            "concept_name": display_name,
            "domain": domain,
            "clarity_score": float(raw_clarity) if raw_clarity is not None else 0.0,
            "misconceptions": normalized_misconceptions,
        }

    return list(normalized.values())


def _recency_factor(last_seen: datetime) -> float:
    """
    Simplified Ebbinghaus forgetting curve.

    Returns 1.0 if the concept was seen within the last 7 days, then decays
    by 0.1 for each additional week. Floors at 0.0.

    The real Ebbinghaus curve is exponential, but a linear step function is
    good enough for our purposes and much easier to reason about in logs.
    """
    days_since = (datetime.utcnow() - last_seen).total_seconds() / 86400
    if days_since <= 7:
        return 1.0
    weeks_past_first = (days_since - 7) / 7
    return max(0.0, 1.0 - 0.1 * weeks_past_first)


def _calculate_mastery(
    clarity_score: float, exposure_count: int, last_seen: datetime
) -> float:
    """
    Deterministic multi-factor mastery calculation.

    Args:
        clarity_score: 0–100 from the evaluator (converted to 0–1 internally).
        exposure_count: Total times this concept has been discussed.
        last_seen: Timestamp of most recent interaction with this concept.

    Returns:
        float in [0.0, 1.0].
    """
    clarity_factor = max(0.0, min(1.0, clarity_score / 100.0))
    exposure_factor = min(exposure_count, 10) / 10.0
    recency = _recency_factor(last_seen)

    mastery = (0.6 * clarity_factor) + (0.3 * exposure_factor) + (0.1 * recency)
    return max(0.0, min(1.0, mastery))


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class ConceptMemoryService:
    """
    Stateless service for UserConceptMemory CRUD.

    All reads/writes go directly to MongoDB — no in-memory caching. This is
    critical because the evaluator may update concepts from a background task
    while a new request is already being processed.
    """

    # --- Load / bootstrap ------------------------------------------------------

    async def get_user_concepts(self, user_id: str) -> UserConceptMemory:
        """
        Load the user's concept memory document, creating an empty one if absent.

        Called by MemoryAgent at the start of every orchestration cycle so the
        planner has visibility into what the user already knows.

        Returns:
            UserConceptMemory — either the persisted document or a new empty one.
        """
        collection = get_concept_memory_collection()

        doc = await collection.find_one({"user_id": user_id})

        if doc:
            doc["_id"] = str(doc["_id"])
            return UserConceptMemory(**doc)

        # Bootstrap an empty concept memory document
        now = datetime.utcnow()
        new_mem = UserConceptMemory(
            user_id=user_id,
            concepts={},
            updated_at=now,
        )
        await collection.insert_one(
            new_mem.model_dump(by_alias=True, exclude={"id"})
        )
        logger.debug("Created empty UserConceptMemory for user=%s", user_id)
        return new_mem

    # --- Concept upsert --------------------------------------------------------

    async def update_concept(
        self,
        user_id: str,
        concept_id: str,
        concept_name: str,
        domain: str,
        clarity_score: float,
        session_id: str,
        misconceptions: Optional[List[str]] = None,
    ) -> None:
        """
        Upsert a single concept in the user's knowledge map.

        This is the main write path, called by the evaluator after scoring an
        interaction. It handles both first-time creation and subsequent updates
        using atomic MongoDB operators to avoid read-modify-write races.

        Mastery is recalculated from scratch each time using the weighted
        formula (see module docstring). The full calculation requires the
        current exposure_count and last_seen, so this method does one read
        then one atomic write.

        Args:
            user_id: Owner of the concept memory.
            concept_id: Slugified concept key (use slugify_concept()).
            concept_name: Human-readable label.
            domain: Knowledge domain, e.g. "dsa", "python".
            clarity_score: 0–100 from the evaluator (NOT 0–1).
            session_id: Chat session that produced this evaluation.
            misconceptions: New misconceptions to add (deduplicated).
        """
        collection = get_concept_memory_collection()
        now = datetime.utcnow()
        prefix = f"concepts.{concept_id}"

        # Ensure the user's concept memory document exists
        await collection.update_one(
            {"user_id": user_id},
            {"$setOnInsert": {"user_id": user_id, "concepts": {}, "updated_at": now}},
            upsert=True,
        )

        # Read current concept state for mastery calculation
        doc = await collection.find_one(
            {"user_id": user_id},
            {f"{prefix}.exposure_count": 1, f"{prefix}.first_seen": 1},
        )

        # Determine if this is a new concept or an update
        existing = (doc.get("concepts") or {}).get(concept_id)
        if existing:
            exposure_count = existing.get("exposure_count", 0) + 1
        else:
            exposure_count = 1

        mastery = _calculate_mastery(clarity_score, exposure_count, now)

        snapshot = MasterySnapshot(
            date=now,
            score=mastery,
            session_id=session_id,
        ).model_dump()

        if existing:
            # --- Update existing concept ---
            update: dict = {
                "$set": {
                    f"{prefix}.last_seen": now,
                    f"{prefix}.last_clarity_score": clarity_score,
                    f"{prefix}.mastery_level": mastery,
                    f"{prefix}.domain": domain,
                    f"{prefix}.concept_name": concept_name,
                    "updated_at": now,
                },
                "$inc": {
                    f"{prefix}.exposure_count": 1,
                },
                # Keep only the 10 most recent mastery readings
                "$push": {
                    f"{prefix}.mastery_history": {
                        "$each": [snapshot],
                        "$slice": -10,
                    },
                },
            }

            if misconceptions:
                # Deduplicate via $addToSet, then cap at 20 via a follow-up $push/$slice
                # MongoDB doesn't support $addToSet + $slice in one op, so we use
                # $addToSet here and cap in a second atomic write below.
                update["$addToSet"] = {
                    f"{prefix}.misconceptions": {"$each": misconceptions}
                }

            await collection.update_one({"user_id": user_id}, update)

            # Cap misconceptions at 20 (keep most recent) — separate atomic op
            if misconceptions:
                await collection.update_one(
                    {"user_id": user_id},
                    {"$push": {
                        f"{prefix}.misconceptions": {"$each": [], "$slice": -20}
                    }},
                )

        else:
            # --- Create new concept record ---
            new_record = {
                "concept_id": concept_id,
                "concept_name": concept_name,
                "domain": domain,
                "mastery_level": mastery,
                "exposure_count": 1,
                "last_clarity_score": clarity_score,
                "misconceptions": (misconceptions or [])[:20],
                "first_seen": now,
                "last_seen": now,
                "mastery_history": [snapshot],
            }
            await collection.update_one(
                {"user_id": user_id},
                {
                    "$set": {
                        f"{prefix}": new_record,
                        "updated_at": now,
                    }
                },
            )

        logger.debug(
            "Updated concept %s for user=%s: mastery=%.3f exposure=%d clarity=%.1f",
            concept_id,
            user_id,
            mastery,
            exposure_count,
            clarity_score,
        )

    # --- Query helpers ---------------------------------------------------------

    async def get_related_concepts(
        self, user_id: str, domain: str
    ) -> List[ConceptRecord]:
        """
        Return all concepts in the given domain, sorted by mastery ascending.

        Used by the planner to understand what related topics the user is
        weakest in, so it can suggest review or prerequisites.
        """
        collection = get_concept_memory_collection()

        doc = await collection.find_one(
            {"user_id": user_id}, {"concepts": 1}
        )

        if not doc or not doc.get("concepts"):
            return []

        records = [
            ConceptRecord(**v)
            for v in doc["concepts"].values()
            if v.get("domain") == domain
        ]
        records.sort(key=lambda r: r.mastery_level)
        return records

    async def get_weak_concepts(
        self, user_id: str, threshold: float = 0.4
    ) -> List[ConceptRecord]:
        """
        Return concepts with mastery below *threshold*, sorted by last_seen
        descending (most recently struggled with first).

        Used by the dashboard and planner to surface recommendations like
        "You might want to revisit recursion — you were confused last time."
        """
        collection = get_concept_memory_collection()

        doc = await collection.find_one(
            {"user_id": user_id}, {"concepts": 1}
        )

        if not doc or not doc.get("concepts"):
            return []

        weak = [
            ConceptRecord(**v)
            for v in doc["concepts"].values()
            if v.get("mastery_level", 0.0) < threshold
        ]
        weak.sort(key=lambda r: r.last_seen, reverse=True)
        return weak

    # --- Compact context for agents --------------------------------------------

    async def get_concept_context_for_agents(
        self, user_id: str, active_concepts: List[str]
    ) -> dict:
        """
        Build a compact concept summary for injection into agent prompts.

        This bridges Layer 2 (persistent knowledge map) with the agent pipeline.
        Agents receive a small dict — not the full document — to keep prompt
        tokens low and signal density high.

        Args:
            user_id: The learner.
            active_concepts: concept_ids from SessionContext.active_concepts.

        Returns:
            {
                "active": {concept_id: {mastery, misconceptions, exposure_count}},
                "related_weak": [{concept_id, concept_name, mastery}],  # up to 5
                "overall_mastery_average": float
            }
            Returns a zero-state dict if the user has no concept memory.
        """
        collection = get_concept_memory_collection()

        doc = await collection.find_one(
            {"user_id": user_id}, {"concepts": 1}
        )

        concepts = (doc or {}).get("concepts", {})

        if not concepts:
            return {
                "active": {},
                "related_weak": [],
                "overall_mastery_average": 0.0,
            }

        # Active concept details
        active: dict = {}
        active_domains: set = set()
        for cid in active_concepts:
            c = concepts.get(cid)
            if c:
                active[cid] = {
                    "mastery": c.get("mastery_level", 0.0),
                    "misconceptions": c.get("misconceptions", []),
                    "exposure_count": c.get("exposure_count", 0),
                }
                active_domains.add(c.get("domain"))

        # Related weak concepts — same domain(s) as active, below 0.4 mastery
        related_weak: list = []
        for v in concepts.values():
            cid = v.get("concept_id", "")
            if cid in active:
                continue  # already in active set
            if v.get("domain") not in active_domains:
                continue
            if v.get("mastery_level", 0.0) >= 0.4:
                continue
            related_weak.append({
                "concept_id": cid,
                "concept_name": v.get("concept_name", cid),
                "mastery": v.get("mastery_level", 0.0),
            })

        # Sort by mastery ascending, take top 5
        related_weak.sort(key=lambda r: r["mastery"])
        related_weak = related_weak[:5]

        # Overall average
        all_mastery = [v.get("mastery_level", 0.0) for v in concepts.values()]
        avg = sum(all_mastery) / len(all_mastery) if all_mastery else 0.0

        return {
            "active": active,
            "related_weak": related_weak,
            "overall_mastery_average": round(avg, 3),
        }


# Singleton instance — matches codebase pattern (see chat_service.py)
concept_memory_service = ConceptMemoryService()
