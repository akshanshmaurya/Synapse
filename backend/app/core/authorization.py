"""Role-based authorization dependencies for route protection.

Provides ready-to-use dependency wrappers for common roles to enforce
least-privilege access across the API.
"""
from fastapi import Depends
from app.auth.dependencies import require_role, get_current_user

# Pre-configured role dependencies for route protection
require_admin = require_role("admin")
require_user = get_current_user  # Any authenticated user
