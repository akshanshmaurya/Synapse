"""
Role-Based Access Control (RBAC) for Synapse API.

Provides FastAPI dependency functions for route-level authorization.
All protected routes must declare these as Depends() parameters.

Roles:
    - admin: Full system access. Required for /api/traces (all-user view),
             destructive batch operations, and admin analytics.
    - user:  Default role. Access to own data only.

Admin routes: /api/traces (global), destructive admin operations.
User routes:  /api/chat, /api/chats/*, /api/user/*, /api/onboarding/*,
              /api/roadmap/*, /api/analytics/* (own data only).

Usage:
    from app.core.authorization import require_admin, require_authenticated_user

    @router.get("/admin-only")
    async def admin_route(user=Depends(require_admin)):
        ...

    @router.get("/any-user")
    async def user_route(user=Depends(require_authenticated_user)):
        ...
"""
from app.auth.dependencies import require_role, get_current_user

# Pre-configured role dependencies for route protection.
# require_admin: raises HTTP 403 if user.role != "admin"
require_admin = require_role("admin")

# require_authenticated_user: raises HTTP 401 if no valid session
require_authenticated_user = get_current_user
