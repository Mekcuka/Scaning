"""Remove projects and users created by Playwright E2E tests.

Usage (from decision-matrix/backend):
  python scripts/cleanup_e2e_data.py

DATABASE_URL defaults to sqlite+aiosqlite:///./data/sppr.db when unset.
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from sqlalchemy import delete, select

from app.core.database import async_session
from app.models import Project, User
from app.services.demo_users import DEMO_USERS
from app.services.project_delete import delete_project_cascade

DEMO_EMAILS = {email for email, *_ in DEMO_USERS}
DEFAULT_DB = "sqlite+aiosqlite:///./data/sppr.db"


def is_test_project(name: str) -> bool:
    return name.startswith("test_") or name.startswith("e2e_")


def is_test_user(email: str) -> bool:
    if email in DEMO_EMAILS:
        return False
    if email.startswith("e2e-"):
        return True
    if email.endswith("@test.ru"):
        return True
    if email.endswith("@t.ru") and (email.startswith("rate") or email.startswith("fresh")):
        return True
    return email == "brandnew@test.ru"


async def cleanup() -> tuple[int, int]:
    deleted_projects = 0
    deleted_users = 0

    async with async_session() as db:
        projects = (await db.execute(select(Project))).scalars().all()
        for project in projects:
            if not is_test_project(project.name):
                continue
            if await delete_project_cascade(db, project.id):
                deleted_projects += 1
        await db.commit()

        users = (await db.execute(select(User))).scalars().all()
        for user in users:
            if not is_test_user(user.email):
                continue
            owned = (
                await db.execute(select(Project).where(Project.user_id == user.id))
            ).scalars().all()
            for project in owned:
                if await delete_project_cascade(db, project.id):
                    deleted_projects += 1
            await db.execute(delete(User).where(User.id == user.id))
            deleted_users += 1
        await db.commit()

    return deleted_projects, deleted_users


async def main() -> None:
    os.environ.setdefault("DATABASE_URL", DEFAULT_DB)
    deleted_projects, deleted_users = await cleanup()
    print(
        f"E2E cleanup: removed {deleted_projects} project(s), {deleted_users} user(s) "
        f"({os.environ['DATABASE_URL']})"
    )


if __name__ == "__main__":
    asyncio.run(main())
