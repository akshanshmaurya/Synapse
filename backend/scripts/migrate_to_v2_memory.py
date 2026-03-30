"""
migrate_to_v2_memory.py
One-time migration: populate Phase 4.7 three-layer memory from legacy data.

Usage:
    python -m scripts.migrate_to_v2_memory             # Full migration
    python -m scripts.migrate_to_v2_memory --dry-run    # Preview only
    python -m scripts.migrate_to_v2_memory --user-id X  # Single user

What it creates:
    1. user_profiles   (Layer 1 — Identity Memory) from user_memory.onboarding + profile
    2. concept_memory  (Layer 2 — Knowledge Map)   empty bootstrap (no legacy concept data)
    3. session_contexts (Layer 3 — Working Memory) from chats + messages collections

Idempotent: uses upsert operations — safe to run multiple times.
"""

import argparse
import asyncio
import logging
import sys
from datetime import datetime

from motor.motor_asyncio import AsyncIOMotorClient

# ---------------------------------------------------------------------------
# Bootstrap: load app settings WITHOUT starting FastAPI
# ---------------------------------------------------------------------------
sys.path.insert(0, ".")
from app.core.config import settings

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-5s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("migrate_v2")

# ---------------------------------------------------------------------------
# Mapping tables (same as profile_service.py — duplicated here so the script
# is self-contained and doesn't depend on the app's import graph)
# ---------------------------------------------------------------------------

# Onboarding mentoring_style -> UserProfileV2 mentoring_tone
TONE_MAP = {
    "gentle": "supportive",
    "supportive": "supportive",
    "direct": "balanced",
    "challenging": "challenging",
}

# Onboarding guidance_type -> career_interests list
GUIDANCE_TO_INTERESTS = {
    "career": ["career-growth"],
    "skills": ["skill-building"],
    "goals": ["goal-planning"],
    "confidence": ["confidence-building"],
    "balance": ["work-life-balance"],
}

# Valid experience levels in the new model
VALID_EXPERIENCE = {"absolute_beginner", "beginner", "intermediate", "advanced"}

# Valid mentoring tones in the new model
VALID_TONES = {"supportive", "balanced", "challenging"}


# ---------------------------------------------------------------------------
# Migration logic
# ---------------------------------------------------------------------------

async def migrate_user(
    db,
    user_id: str,
    dry_run: bool,
) -> dict:
    """
    Migrate a single user's data to the three-layer memory model.

    Returns a stats dict: {profiles, concepts, sessions, errors, skipped_reason}
    """
    stats = {"profiles": 0, "concepts": 0, "sessions": 0, "errors": []}
    now = datetime.utcnow()

    # --- Load legacy data ---
    memory_doc = await db["user_memory"].find_one({"user_id": user_id})
    if not memory_doc:
        log.info("  [skip] user=%s has no user_memory document", user_id)
        stats["skipped_reason"] = "no_user_memory"
        return stats

    onboarding = memory_doc.get("onboarding", {})
    profile = memory_doc.get("profile", {})

    # =====================================================================
    # Layer 1: user_profiles (Identity Memory)
    # =====================================================================
    try:
        # --- Map experience_level ---
        raw_exp = onboarding.get("experience_level", "beginner")
        experience_level = raw_exp if raw_exp in VALID_EXPERIENCE else "beginner"

        # --- Map mentoring_style -> mentoring_tone ---
        raw_style = onboarding.get("mentoring_style", "balanced")
        mentoring_tone = TONE_MAP.get(raw_style, "balanced")
        if mentoring_tone not in VALID_TONES:
            mentoring_tone = "balanced"

        # --- Map career_interests ---
        # Priority: legacy profile.interests, then onboarding.guidance_type
        legacy_interests = profile.get("interests", [])
        if legacy_interests and isinstance(legacy_interests, list):
            career_interests = legacy_interests
        else:
            guidance = onboarding.get("guidance_type", "")
            career_interests = GUIDANCE_TO_INTERESTS.get(guidance, [])

        # --- Map strengths/weaknesses from legacy profile ---
        # These aren't stored in the legacy model as lists, but struggles
        # give us weakness signals. Strengths don't exist in legacy.
        struggles = memory_doc.get("struggles", [])
        global_weaknesses = []
        for s in struggles:
            topic = s.get("topic", "")
            if topic and s.get("count", 0) >= 2:
                # Only count struggles seen 2+ times as global weaknesses
                global_weaknesses.append(topic)
        global_weaknesses = global_weaknesses[:20]  # Cap

        profile_doc = {
            "user_id": user_id,
            "experience_level": experience_level,
            "preferred_learning_style": "mixed",  # Not captured in legacy wizard
            "mentoring_tone": mentoring_tone,
            "career_interests": career_interests,
            "global_strengths": [],  # No legacy source for this
            "global_weaknesses": global_weaknesses,
            "created_at": memory_doc.get("created_at", now),
            "updated_at": now,
        }

        if dry_run:
            log.info("  [dry-run] WOULD upsert user_profiles: %s", _summary(profile_doc))
        else:
            await db["user_profiles"].update_one(
                {"user_id": user_id},
                {"$set": profile_doc, "$setOnInsert": {"user_id": user_id}},
                upsert=True,
            )
        stats["profiles"] = 1
        log.info(
            "  [L1] profile: exp=%s tone=%s interests=%s weaknesses=%d",
            experience_level, mentoring_tone, career_interests, len(global_weaknesses),
        )

    except Exception as e:
        log.error("  [L1] profile creation FAILED for user=%s: %s", user_id, e)
        stats["errors"].append(f"L1: {e}")

    # =====================================================================
    # Layer 2: concept_memory (Knowledge Map) — empty bootstrap
    # =====================================================================
    try:
        concept_doc = {
            "user_id": user_id,
            "concepts": {},  # Empty — future evaluations will populate this
            "updated_at": now,
        }

        if dry_run:
            log.info("  [dry-run] WOULD upsert concept_memory: user=%s (empty)", user_id)
        else:
            await db["concept_memory"].update_one(
                {"user_id": user_id},
                {"$setOnInsert": concept_doc},
                upsert=True,
            )
        stats["concepts"] = 1
        log.info("  [L2] concept_memory: bootstrapped (empty)")

    except Exception as e:
        log.error("  [L2] concept_memory creation FAILED for user=%s: %s", user_id, e)
        stats["errors"].append(f"L2: {e}")

    # =====================================================================
    # Layer 3: session_contexts (Working Memory) — from existing chats
    # =====================================================================
    try:
        chats_cursor = db["chats"].find({"user_id": user_id}, {"_id": 1})
        chat_ids = [str(doc["_id"]) async for doc in chats_cursor]

        if not chat_ids:
            log.info("  [L3] no chats found — skipping session_contexts")
        else:
            for chat_id in chat_ids:
                try:
                    # Count actual messages for this chat
                    msg_count = await db["messages"].count_documents({"chat_id": chat_id})

                    session_doc = {
                        "session_id": chat_id,
                        "user_id": user_id,
                        "session_goal": None,        # Can't retroactively infer goals
                        "session_domain": None,
                        "active_concepts": [],
                        "session_clarity": 50.0,     # Neutral default
                        "session_confusion_points": [],
                        "message_count": msg_count,
                        "session_momentum": "warming_up",  # Safe default
                        "created_at": now,
                        "updated_at": now,
                    }

                    if dry_run:
                        log.info(
                            "  [dry-run] WOULD upsert session_context: session=%s msgs=%d",
                            chat_id, msg_count,
                        )
                    else:
                        await db["session_contexts"].update_one(
                            {"session_id": chat_id, "user_id": user_id},
                            {"$setOnInsert": session_doc},
                            upsert=True,
                        )
                    stats["sessions"] += 1

                except Exception as e:
                    log.error(
                        "  [L3] session_context FAILED for chat=%s: %s", chat_id, e
                    )
                    stats["errors"].append(f"L3 chat={chat_id}: {e}")

            log.info("  [L3] session_contexts: %d/%d chats migrated", stats["sessions"], len(chat_ids))

    except Exception as e:
        log.error("  [L3] chat enumeration FAILED for user=%s: %s", user_id, e)
        stats["errors"].append(f"L3 enum: {e}")

    return stats


def _summary(doc: dict) -> str:
    """Compact summary for dry-run logging."""
    return (
        f"exp={doc.get('experience_level')} "
        f"tone={doc.get('mentoring_tone')} "
        f"interests={doc.get('career_interests')} "
        f"weaknesses={len(doc.get('global_weaknesses', []))}"
    )


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

async def main():
    parser = argparse.ArgumentParser(
        description="Migrate legacy user_memory to Phase 4.7 three-layer memory.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what WOULD be created without writing to the database.",
    )
    parser.add_argument(
        "--user-id",
        type=str,
        default=None,
        help="Migrate a single user (for testing). Provide user_id string.",
    )
    args = parser.parse_args()

    if args.dry_run:
        log.info("=== DRY RUN MODE — no writes will be made ===")

    # --- Connect to MongoDB ---
    log.info("Connecting to MongoDB: %s", settings.MONGODB_DB)
    client = AsyncIOMotorClient(
        settings.MONGO_URI,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=10000,
    )
    # Verify connection
    await client.admin.command("ping")
    db = client[settings.MONGODB_DB]
    log.info("Connected successfully.")

    # --- Gather users to migrate ---
    if args.user_id:
        user_ids = [args.user_id]
        log.info("Single-user mode: migrating user=%s", args.user_id)
    else:
        # Get all user IDs from the users collection
        cursor = db["users"].find({}, {"_id": 1})
        user_ids = [str(doc["_id"]) async for doc in cursor]
        log.info("Found %d users to migrate.", len(user_ids))

    # --- Migrate ---
    totals = {"users": 0, "profiles": 0, "concepts": 0, "sessions": 0, "errors": 0, "skipped": 0}

    for user_id in user_ids:
        log.info("--- Migrating user=%s ---", user_id)
        try:
            stats = await migrate_user(db, user_id, args.dry_run)
            totals["users"] += 1
            totals["profiles"] += stats["profiles"]
            totals["concepts"] += stats["concepts"]
            totals["sessions"] += stats["sessions"]
            totals["errors"] += len(stats["errors"])
            if stats.get("skipped_reason"):
                totals["skipped"] += 1
        except Exception as e:
            log.error("FATAL error migrating user=%s: %s", user_id, e, exc_info=True)
            totals["errors"] += 1

    # --- Report ---
    log.info("")
    log.info("=" * 60)
    log.info("MIGRATION %s", "PREVIEW (dry run)" if args.dry_run else "COMPLETE")
    log.info("=" * 60)
    log.info("  Users processed : %d", totals["users"])
    log.info("  Users skipped   : %d (no user_memory)", totals["skipped"])
    log.info("  Profiles created: %d", totals["profiles"])
    log.info("  Concepts created: %d (all empty bootstraps)", totals["concepts"])
    log.info("  Sessions created: %d", totals["sessions"])
    log.info("  Errors          : %d", totals["errors"])
    log.info("=" * 60)

    if totals["errors"] > 0:
        log.warning("Some errors occurred — review the log above for details.")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
