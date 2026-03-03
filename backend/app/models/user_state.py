from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime

class Interaction(BaseModel):
    timestamp: str
    user_input: str
    bot_response: str
    strategy_used: str
    success_score: Optional[float] = None

class UserState(BaseModel):
    user_id: str
    interests: List[str] = []
    goals: List[str] = []
    struggles: List[str] = []
    emotional_trend: List[str] = []
    strategy_history: List[str] = []
    recent_interactions: List[Interaction] = []
    last_interaction: Optional[str] = None
