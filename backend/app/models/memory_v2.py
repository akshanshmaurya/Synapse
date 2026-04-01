"""
Phase 4.7 — Three-Layer Memory Schema

Replaces the flat UserMemory model with a cognitively-grounded architecture:

    Layer 1: UserProfile (Identity Memory)
        Long-term, stable traits about the learner. Analogous to semantic memory
        in cognitive science — facts about oneself that persist across contexts.

    Layer 2: UserConceptMemory / ConceptRecord (Knowledge Map)
        Per-concept mastery tracking. Analogous to the learner's mental model or
        schema — structured knowledge that accumulates and reorganises over time.

    Layer 3: SessionContext (Working Memory)
        Per-chat ephemeral state. Analogous to working memory — limited-capacity,
        goal-directed context that is active only during a conversation.

MongoDB collections:
    - user_profiles      -> one UserProfile per user
    - user_concept_memory -> one UserConceptMemory per user (concepts dict inside)
    - session_contexts   -> one SessionContext per chat session
"""

from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, List, Dict
from datetime import datetime


# ---------------------------------------------------------------------------
# Layer 1: UserProfile (Identity Memory)
# ---------------------------------------------------------------------------

class UserProfileV2(BaseModel):
    """
    Identity Memory — long-term, slowly-changing facts about the learner.

    Cognitive science equivalent: *semantic self-knowledge* — stable traits,
    preferences, and background that inform how the mentor should communicate
    regardless of the current topic or session.

    One document per user in the `user_profiles` collection.
    """

    model_config = ConfigDict(populate_by_name=True)

    id: Optional[str] = Field(None, alias="_id")

    # --- Identity ---
    user_id: str  # Foreign key to `users` collection — links profile to auth record

    age_group: Optional[str] = None
    # Nullable because the user may choose not to disclose.
    # Values: "teen", "college", "early_career", "mid_career", "career_switch"
    # Used to calibrate example complexity and cultural references.

    education_level: Optional[str] = None
    # Nullable — same privacy reasoning as age_group.
    # Values: "high_school", "undergraduate", "graduate", "self_taught", "bootcamp"
    # Helps the planner decide prerequisite depth.

    experience_level: str = "beginner"
    # Values: "absolute_beginner", "beginner", "intermediate", "advanced"
    # Core routing signal — determines initial pacing and vocabulary level.

    # --- Learning preferences ---
    preferred_learning_style: str = "mixed"
    # Values: "visual", "conceptual", "hands_on", "mixed"
    # Tells the executor HOW to explain: diagrams vs. analogies vs. exercises.

    mentoring_tone: str = "balanced"
    # Values: "supportive", "challenging", "balanced"
    # Controls emotional register of mentor responses.

    career_interests: List[str] = []
    # e.g. ["backend", "ml", "frontend"]
    # Guides roadmap generation and example selection toward relevant domains.

    # --- Evaluator-derived (populated over time, never set by user directly) ---
    global_strengths: List[str] = []
    # Concepts or skill areas where the user consistently scores high clarity.
    # Lets the planner skip redundant review and push toward harder material.

    global_weaknesses: List[str] = []
    # Concepts or skill areas where the user repeatedly struggles.
    # Triggers the planner to slow down and the executor to add scaffolding.

    inferred_vocabulary_level: Optional[str] = None
    # "basic" | "intermediate" | "technical"
    
    implicit_career_signals: List[str] = []
    # soft goals detected from casual chat, capped at 20

    # --- Timestamps ---
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    @field_validator("experience_level")
    @classmethod
    def validate_experience_level(cls, v: str) -> str:
        allowed = {"absolute_beginner", "beginner", "intermediate", "advanced"}
        if v not in allowed:
            raise ValueError(f"experience_level must be one of {allowed}")
        return v

    @field_validator("preferred_learning_style")
    @classmethod
    def validate_learning_style(cls, v: str) -> str:
        allowed = {"visual", "conceptual", "hands_on", "mixed"}
        if v not in allowed:
            raise ValueError(f"preferred_learning_style must be one of {allowed}")
        return v

    @field_validator("mentoring_tone")
    @classmethod
    def validate_mentoring_tone(cls, v: str) -> str:
        allowed = {"supportive", "challenging", "balanced"}
        if v not in allowed:
            raise ValueError(f"mentoring_tone must be one of {allowed}")
        return v


# ---------------------------------------------------------------------------
# Layer 2: ConceptMemory (Knowledge Map)
# ---------------------------------------------------------------------------

class MasterySnapshot(BaseModel):
    """A single point-in-time mastery reading for trend analysis."""
    date: datetime = Field(default_factory=datetime.utcnow)
    score: float  # 0.0–1.0 mastery at this point
    session_id: str  # Which chat session produced this reading


class ConceptRecord(BaseModel):
    """
    Per-concept knowledge node — tracks mastery of a single idea over time.

    Cognitive science equivalent: a *schema* — a unit of organised knowledge
    that strengthens with successful retrieval and weakens with confusion.
    Misconceptions are recorded so the mentor can explicitly address them
    rather than letting them calcify.

    Embedded inside UserConceptMemory.concepts dict, keyed by concept_id.
    """

    concept_id: str
    # Slugified, URL-safe identifier, e.g. "recursion", "binary-search".
    # Used as the dict key and for cross-referencing in SessionContext.active_concepts.

    concept_name: str
    # Human-readable label, e.g. "Recursion".
    # Displayed in roadmaps and progress dashboards.

    domain: str
    # Knowledge domain grouping, e.g. "dsa", "python", "system_design".
    # Enables domain-level filtering for the planner and analytics.

    mastery_level: float = 0.0
    # 0.0 (no exposure) to 1.0 (full mastery).
    # Updated by the evaluator after each interaction involving this concept.

    exposure_count: int = 0
    # How many times this concept has appeared in conversation.
    # High exposure + low mastery = the user is stuck; triggers planner intervention.

    last_clarity_score: Optional[float] = None
    # The most recent per-concept clarity reading from the evaluator.
    # Nullable because there may be no evaluation yet (concept only mentioned, not tested).

    misconceptions: List[str] = []
    # Known misunderstandings, e.g. "thinks recursion always uses more memory than iteration".
    # The executor injects targeted corrections when these are present.

    first_seen: datetime = Field(default_factory=datetime.utcnow)
    # When this concept first appeared — useful for spacing-effect calculations.

    last_seen: datetime = Field(default_factory=datetime.utcnow)
    # Recency signal — concepts not seen recently may need review (spaced repetition).

    mastery_history: List[MasterySnapshot] = []
    # Capped at last 10 entries (enforced at write time, not model level).
    # Provides trend data: is mastery going up, plateauing, or regressing?

    @field_validator("mastery_level")
    @classmethod
    def clamp_mastery(cls, v: float) -> float:
        return max(0.0, min(1.0, v))


class UserConceptMemory(BaseModel):
    """
    Knowledge Map — the complete set of concepts a user has encountered.

    One document per user in the `user_concept_memory` collection.
    The concepts dict grows over time as new topics are discussed.
    """

    model_config = ConfigDict(populate_by_name=True)

    id: Optional[str] = Field(None, alias="_id")

    user_id: str
    # Foreign key to `users` collection.

    concepts: Dict[str, ConceptRecord] = {}
    # Keyed by concept_id for O(1) lookup.
    # New concepts are inserted by the evaluator when first detected in conversation.

    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# Layer 3: SessionContext (Working Memory)
# ---------------------------------------------------------------------------

class SessionContext(BaseModel):
    """
    Working Memory — ephemeral, goal-directed state for a single chat session.

    Cognitive science equivalent: *working memory* — the small, active set of
    information being manipulated right now. It is goal-oriented (what is the
    user trying to learn?), capacity-limited (only a few concepts at once),
    and discarded when the session ends (though its insights are promoted to
    Layer 1 and Layer 2 before disposal).

    One document per chat session in the `session_contexts` collection.
    Created when a chat starts, updated every message, referenced until chat ends.
    """

    model_config = ConfigDict(populate_by_name=True)

    id: Optional[str] = Field(None, alias="_id")

    session_id: str
    # Same as chat_id — 1:1 mapping with ChatSession.
    # This is the primary lookup key for all per-session queries.

    user_id: str
    # Foreign key to `users` collection.
    # Needed for cross-layer queries (e.g. "get session + profile in one call").

    session_goal: Optional[str] = None
    # What the user is trying to learn or accomplish in THIS chat.
    # Nullable until the planner infers it or the user states it explicitly.
    # e.g. "understand recursion", "build a REST API", "prepare for interviews"

    session_intent: str = "unknown"
    # Possible values:
    # "unknown"         — not yet classified (first 1–2 messages)
    # "learning"        — user is trying to understand or master something
    # "problem_solving" — user has a specific task/problem to solve (e.g. debug this code)
    # "casual"          — general conversation, no learning intent detected
    # "review"          — user is explicitly revisiting something they've seen before

    goal_inferred: bool = False
    # True when session_goal was set by the system (inference), not the user.
    # Used by the UI to show the goal as a suggestion rather than confirmed fact.

    goal_confirmed: bool = False
    # True when user has explicitly confirmed, edited, or set the goal themselves.
    # Once True, goal_inferred is irrelevant.

    intent_classified_at_message: Optional[int] = None
    # Which message number triggered the intent classification.
    # None = not yet classified.
    # Stored for debugging and analytics.

    session_domain: Optional[str] = None
    # Inferred domain for this session, e.g. "dsa", "python", "system_design".
    # Used to scope concept lookups and domain-specific prompting.

    active_concepts: List[str] = []
    # concept_ids currently being discussed in this session.
    # Keeps the evaluator focused on the right concepts for scoring.

    session_clarity: float = 50.0
    # Clarity score scoped to THIS session only (0.0–100.0).
    # Prevents cross-session contamination — a user who is great at Python
    # but struggling with DSA won't have their DSA clarity inflated.

    session_confusion_points: List[str] = []
    # Specific points of confusion in THIS session.
    # Fed to the executor so it can address them directly rather than guessing.

    message_count: int = 0
    # Number of messages exchanged in this session.
    # Used by the planner to detect early-session vs. deep-conversation dynamics.

    session_momentum: str = "cold_start"
    # Values: "cold_start", "warming_up", "flowing", "stuck", "wrapping_up"
    # Derived from message_count + clarity trend within the session.
    # Tells the planner how aggressive or gentle to be.

    # --- Timestamps ---
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    @field_validator("session_clarity")
    @classmethod
    def clamp_clarity(cls, v: float) -> float:
        return max(0.0, min(100.0, v))

    @field_validator("session_momentum")
    @classmethod
    def validate_momentum(cls, v: str) -> str:
        allowed = {"cold_start", "warming_up", "flowing", "stuck", "wrapping_up"}
        if v not in allowed:
            raise ValueError(f"session_momentum must be one of {allowed}")
        return v
