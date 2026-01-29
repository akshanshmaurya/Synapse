"""
MongoDB Connection Module
Uses Motor for async MongoDB operations
"""
import os
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional

class MongoDB:
    client: Optional[AsyncIOMotorClient] = None
    db = None

    @classmethod
    def connect(cls):
        """Connect to MongoDB"""
        mongo_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
        db_name = os.getenv("MONGODB_DB", "gentle_guide")
        
        cls.client = AsyncIOMotorClient(mongo_url)
        cls.db = cls.client[db_name]
        print(f"Connected to MongoDB: {db_name}")

    @classmethod
    def close(cls):
        """Close MongoDB connection"""
        if cls.client:
            cls.client.close()
            print("MongoDB connection closed")

    @classmethod
    def get_db(cls):
        """Get database instance"""
        if cls.db is None:
            cls.connect()
        return cls.db

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
