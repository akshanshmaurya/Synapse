"""
MongoDB Connection Module
Uses Motor for async MongoDB operations
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
            # TTL: auto-delete sessions inactive for 30 days (2,592,000 seconds)
            # Sessions shouldn't live forever — 30 days is generous for users who take breaks
            await session_contexts.create_index(
                "updated_at", expireAfterSeconds=2_592_000
            )

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
