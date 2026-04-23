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
from fastapi import Depends
from app.auth.dependencies import require_role, get_current_user


# ── Pre-configured authorization dependencies ────────────────────────────
# Import these directly into route files for clean, discoverable RBAC.

def require_admin(current_user: dict = Depends(require_role("admin"))):
    """Require admin role — raises HTTP 403 if user.role != 'admin'.

    Use as a FastAPI dependency on routes that expose cross-user data
    or perform destructive administrative operations.
    """
    return current_user


async def require_authenticated_user(current_user: dict = Depends(get_current_user)):
    """Require any authenticated user — raises HTTP 401 if no valid session.

    This is the default authorization level for most API routes.
    Data isolation (users only see own data) is enforced at the query level.
    """
    return current_user
