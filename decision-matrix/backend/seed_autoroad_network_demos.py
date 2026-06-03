"""Seed autoroad network demonstration projects (idempotent)."""

import asyncio
import os

from sqlalchemy import select, text

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./data/sppr.db")

from app.core.config import settings
from app.core.database import async_session
from app.services.autoroad_network.demo_projects import DEMO_PREFIX, DEMO_SCENARIOS, ensure_autoroad_network_demo_projects
from app.services.demo_users import DEMO_USERS, ensure_demo_users
from app.models import Project, User


async def seed_autoroad_demos() -> None:
    from app.core.database import Base, engine

    async with engine.begin() as conn:
        if not settings.is_sqlite:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        await ensure_demo_users(db)
        await db.commit()

        created = await ensure_autoroad_network_demo_projects(db)
        analyst = await db.scalar(select(User).where(User.email == "engineer@oilgas.ru"))
        if not analyst:
            print("Demo user engineer@oilgas.ru not found")
            return

        all_demos = (
            await db.execute(
                select(Project.id, Project.name).where(
                    Project.user_id == analyst.id,
                    Project.name.like(f"{DEMO_PREFIX}%"),
                )
            )
        ).all()

        if created:
            print("Created autoroad network demo projects:")
            for title in created:
                print(f"  - {DEMO_PREFIX} {title}")
        else:
            print("All autoroad network demo projects already exist.")

        print(f"\nTotal demo projects ({len(all_demos)}/{len(DEMO_SCENARIOS)}):")
        for pid, name in all_demos:
            print(f"  {name}")
            print(f"    /map?project={pid}")

        print("\nLogin: engineer@oilgas.ru / password123")


if __name__ == "__main__":
    asyncio.run(seed_autoroad_demos())
