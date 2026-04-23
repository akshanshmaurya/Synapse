"""
MongoDB Database Layer for Synapse.

SECURITY NOTE — SQL Injection: Synapse uses MongoDB (NoSQL), which is not
susceptible to SQL injection attacks. All database operations use the Motor
async driver with parameterized queries and Pydantic v2 model validation,
which provides structural protection against NoSQL injection.

Input validation: All user inputs are validated by Pydantic models before
reaching database operations. User-provided text is additionally sanitized
by app.utils.sanitizer before storage.
"""
import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional
from app.core.config import settings
from app.utils.logger import logger

class MongoDB:
    client: Optional[AsyncIOMotorClient] = None
    db = None

    @classmethod
    async def connect(cls):
        """Connect to MongoDB with resilience"""
        max_retries = 3
        retry_delay = 2

        for attempt in range(1, max_retries + 1):
            try:
                logger.info(f"MongoDB connection attempt {attempt}/{max_retries}")
                cls.client = AsyncIOMotorClient(
                    settings.MONGO_URI,
                    serverSelectionTimeoutMS=5000,
                    connectTimeoutMS=10000,
                )
                # Verify connection
                await cls.client.admin.command('ping')
                cls.db = cls.client[settings.MONGODB_DB]
                logger.info("MongoDB connected successfully: %s", settings.MONGODB_DB)
                
                # Create indexes asynchronously upon successful connection
                await cls.create_all_indexes()
                return
            except Exception as e:
                logger.error(f"MongoDB connection failed: {e}")
                if attempt < max_retries:
                    logger.info(f"Retrying in {retry_delay} seconds...")
                    await asyncio.sleep(retry_delay)
                else:
                    logger.critical("Could not connect to MongoDB after multiple attempts. Exiting.")
                    sys.exit(1)

    @classmethod
    def close(cls):
        """Close MongoDB connection"""
        if cls.client:
            cls.client.close()
            logger.info("MongoDB connection closed")

    @classmethod
    def get_db(cls):
        """Get database instance. Note: connect() must be explicitly called first in async context."""
        if cls.db is None:
            logger.warning("get_db called before connection established. This may cause errors if not handled.")
        return cls.db

    @classmethod
    async def create_all_indexes(cls):
        """Create all necessary indexes for collections"""
        if cls.db is None:
            return

        try:
            # Users
            users = cls.db["users"]
            await users.create_index("email", unique=True)
            await users.create_index("role")

            # Sessions (Refresh Tokens)
            sessions = cls.db["sessions"]
            await sessions.create_index("user_id")
            # TTL index to automatically delete expired sessions
            await sessions.create_index("expires_at", expireAfterSeconds=0)

            # Chats
            chats = cls.db["chats"]
            await chats.create_index([("user_id", 1), ("updated_at", -1)])
            
            # Messages
            messages = cls.db["messages"]
            await messages.create_index([("chat_id", 1), ("timestamp", -1)])
            await messages.create_index("user_id")

            # Roadmaps
            roadmaps = cls.db["roadmaps"]
            await roadmaps.create_index("user_id")

            # Roadmap Feedback
            roadmap_feedback = cls.db["roadmap_feedback"]
            await roadmap_feedback.create_index([("user_id", 1), ("roadmap_id", 1)])

            # Agent Logs
            agent_logs = cls.db["agent_logs"]
            await agent_logs.create_index([("user_id", 1), ("timestamp", -1)])

            # User Memory (legacy flat memory)
            user_memory = cls.db["user_memory"]
            await user_memory.create_index("user_id", unique=True)

            # Interactions
            interactions = cls.db["interactions"]
            await interactions.create_index([("user_id", 1), ("timestamp", -1)])

            # ------------------------------------------------------------------
            # Phase 4.7: Three-Layer Memory Collections
            # ------------------------------------------------------------------

            # Layer 1: User Profiles (Identity Memory)
            # One document per user — stores stable learner traits and preferences
            user_profiles = cls.db["user_profiles"]
            # Unique: exactly one profile per user
            await user_profiles.create_index("user_id", unique=True)
            # For querying recently-updated profiles (admin dashboards, batch jobs)
            await user_profiles.create_index("updated_at")

            # Layer 2: Concept Memory (Knowledge Map)
            # One document per user — contains a dict of per-concept mastery records
            concept_memory = cls.db["concept_memory"]
            # Unique: exactly one concept memory document per user
            await concept_memory.create_index("user_id", unique=True)
            # Compound: enables efficient "get user's concept memory updated since X" queries
            await concept_memory.create_index([("user_id", 1), ("updated_at", -1)])

            # Layer 3: Session Contexts (Working Memory)
            # One document per chat session — ephemeral, goal-directed state
            session_contexts = cls.db["session_contexts"]
            # Unique compound: one context per session per user
            await session_contexts.create_index(
                [("session_id", 1), ("user_id", 1)], unique=True
            )
            # For fetching all sessions belonging to a user
            await session_contexts.create_index("user_id")
            # TTL: auto-delete sessions inactive for N days (configurable)
            await session_contexts.create_index(
                "updated_at",
                expireAfterSeconds=settings.SESSION_CONTEXT_TTL_DAYS * 86_400,
            )

            # ------------------------------------------------------------------
            # Observability & Analytics
            # ------------------------------------------------------------------

            # System Traces (Cognitive Trace Panel)
            system_traces = cls.db["system_traces"]
            await system_traces.create_index([("user_id", 1), ("session_id", 1)])
            await system_traces.create_index("timestamp", expireAfterSeconds=30 * 86_400)

            # Learning Analyses (Phase 5.4B — periodic pattern analysis logs)
            learning_analyses = cls.db["learning_analyses"]
            await learning_analyses.create_index([("user_id", 1), ("created_at", -1)])

            logger.info("Database indexes successfully verified/created.")
        except Exception as e:
            logger.error("Failed to create database indexes: %s", e)

def get_database():
    return MongoDB.get_db()


def get_collection(name: str):
    """Generic collection accessor — returns a Motor collection by name."""
    return MongoDB.get_db()[name]


# Collections
def get_users_collection():
    return MongoDB.get_db()["users"]

def get_sessions_collection():
    return MongoDB.get_db()["sessions"]

def get_user_memory_collection():
    return MongoDB.get_db()["user_memory"]

def get_interactions_collection():
    return MongoDB.get_db()["interactions"]

def get_roadmaps_collection():
    return MongoDB.get_db()["roadmaps"]

def get_roadmap_feedback_collection():
    return MongoDB.get_db()["roadmap_feedback"]

def get_agent_logs_collection():
    return MongoDB.get_db()["agent_logs"]

# NEW: Chat history collections (separate from memory)
def get_chats_collection():
    """Collection for chat sessions"""
    return MongoDB.get_db()["chats"]

def get_messages_collection():
    """Collection for individual chat messages"""
    return MongoDB.get_db()["messages"]

# Phase 4.7: Three-Layer Memory collections
def get_user_profiles_collection():
    """Layer 1 — Identity Memory (one per user)"""
    return MongoDB.get_db()["user_profiles"]

def get_concept_memory_collection():
    """Layer 2 — Knowledge Map (one per user, concepts dict inside)"""
    return MongoDB.get_db()["concept_memory"]

def get_session_contexts_collection():
    """Layer 3 — Working Memory (one per chat session, TTL 30 days)"""
    return MongoDB.get_db()["session_contexts"]

def get_system_traces_collection():
    """Cognitive Trace Panel — structured pipeline observability logs"""
    return MongoDB.get_db()["system_traces"]

def get_learning_analyses_collection():
    """Phase 5.4B — periodic learning pattern analysis records"""
    return MongoDB.get_db()["learning_analyses"]
