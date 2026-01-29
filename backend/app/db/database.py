import json
import os
from typing import Dict, Any

DB_FILE = "user_data.json"

class Database:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Database, cls).__new__(cls)
            cls._instance._load_db()
        return cls._instance

    def _load_db(self):
        if not os.path.exists(DB_FILE):
            self.data = {}
        else:
            try:
                with open(DB_FILE, "r") as f:
                    self.data = json.load(f)
            except json.JSONDecodeError:
                self.data = {}

    def _save_db(self):
        with open(DB_FILE, "w") as f:
            json.dump(self.data, f, indent=4)

    def get_user(self, user_id: str) -> Dict[str, Any]:
        return self.data.get(user_id, {})

    def save_user(self, user_id: str, user_data: Dict[str, Any]):
        self.data[user_id] = user_data
        self._save_db()

db = Database()
