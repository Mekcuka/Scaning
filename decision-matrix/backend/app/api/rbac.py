from fastapi import Depends

from app.api.deps import get_current_user
from app.core.permission_messages import deny_role_required
from app.models import User
from app.models.enums import UserRole
from app.services.project_access import user_role


def require_roles(*roles: UserRole):
    allowed = set(roles)

    async def checker(user: User = Depends(get_current_user)) -> User:
        if user_role(user) not in allowed:
            deny_role_required(user, *roles)
        return user

    return checker


require_admin = require_roles(UserRole.admin)
