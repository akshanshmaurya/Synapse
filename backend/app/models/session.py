from datetime import datetime
from pydantic import BaseModel, ConfigDict
from bson import ObjectId


class SessionInDB(BaseModel):
    user_id: str
    hashed_token: str
    expires_at: datetime
    created_at: datetime = datetime.now()

    model_config = ConfigDict(arbitrary_types_allowed=True)
