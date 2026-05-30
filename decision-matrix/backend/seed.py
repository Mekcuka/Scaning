"""Seed demo data for development."""
import asyncio
import os

from sqlalchemy import select, text

# Align with run_local.py — seed the same SQLite DB the dev server uses
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./data/sppr.db")

from app.core.config import settings
from app.core.database import async_session
from app.geo.geometry_utils import build_infra_geometry, point_wkt
from app.services.demo_users import DEMO_USERS, ensure_demo_users
from app.models import (
    InfrastructureLayer,
    InfrastructureObject,
    PointOfInterest,
    Project,
    ProjectCostRates,
    ProjectDistanceDefaults,
    ProjectEconomicParams,
    User,
)
from app.models.enums import UserRole
from app.services.cost_rates import DEFAULT_COST_RATES
from app.services.economic_rates import DEFAULT_ECONOMIC_PARAMS

async def seed():
    from app.core.database import Base, engine

    async with engine.begin() as conn:
        if not settings.is_sqlite:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        created_users = await ensure_demo_users(db)
        users: dict[str, User] = {}
        for email, _, _, _ in DEMO_USERS:
            user = await db.scalar(select(User).where(User.email == email))
            if user:
                users[email] = user

        analyst = users["engineer@oilgas.ru"]
        existing_project = await db.scalar(select(Project).where(Project.user_id == analyst.id).limit(1))
        if existing_project:
            if existing_project.visibility != "published":
                existing_project.visibility = "published"
            await db.commit()
            if created_users:
                print("Added demo users:", ", ".join(created_users))
            else:
                print("Demo users already present")
            print("Demo accounts:")
            for email, _, role, password in DEMO_USERS:
                print(f"  {email} / {password} ({role.value})")
            return

        if created_users:
            print("Added demo users:", ", ".join(created_users))
        project = Project(
            user_id=analyst.id,
            name="Участок Западный",
            description="Разработка западного участка",
            status="active",
            visibility="published",
        )
        db.add(project)
        await db.flush()

        db.add(ProjectCostRates(project_id=project.id, rates=dict(DEFAULT_COST_RATES)))
        db.add(ProjectEconomicParams(project_id=project.id, params=dict(DEFAULT_ECONOMIC_PARAMS)))
        db.add(ProjectDistanceDefaults(project_id=project.id))

        db.add(
            PointOfInterest(
                project_id=project.id,
                name="Точка интереса 1",
                geometry=point_wkt(37.6176, 55.7558),
                longitude=37.6176,
                latitude=55.7558,
                planned_production_volume=50,
                production_per_well=10,
                wells_per_pad=4,
                fluid_type="oil",
                eng_power="external",
                eng_injection="centralized",
                eng_gas="well",
                eng_oil_preparation="mkos",
                eng_transport="auto",
            )
        )

        layer = InfrastructureLayer(
            project_id=project.id, name="Инфраструктура", layer_type="vector", source_type="manual"
        )
        db.add(layer)
        await db.flush()

        objects = [
            ("Автодорога М-11", "autoroad", 37.55, 55.82, 37.60, 55.85),
            ("ГКС Восток", "gas_processing", 37.65, 55.68, None, None),
            ("ПС-110", "substation", 37.58, 55.76, None, None),
            ("ГТЭС-1", "gtes", 37.62, 55.72, None, None),
            ("ЛЭП-35", "power_line", 37.60, 55.74, 37.65, 55.78),
            ("Газопровод Север", "gas_pipeline", 37.58, 55.78, 37.68, 55.82),
        ]
        for name, subtype, lon, lat, endlon, endlat in objects:
            if endlon is not None:
                geom = build_infra_geometry(subtype, lon, lat, end_lon=endlon, end_lat=endlat)
            else:
                geom = build_infra_geometry(subtype, lon, lat)
            from app.geo.validation import category_for_subtype

            db.add(
                InfrastructureObject(
                    layer_id=layer.id,
                    name=name,
                    subtype=subtype,
                    category=category_for_subtype(subtype),
                    geometry=geom,
                    longitude=lon,
                    latitude=lat,
                    end_longitude=endlon,
                    end_latitude=endlat,
                )
            )

        await db.commit()
        print("Seed OK — demo accounts:")
        for email, _, role, password in DEMO_USERS:
            print(f"  {email} / {password} ({role.value})")
        print(f"Published project id: {project.id}")


if __name__ == "__main__":
    asyncio.run(seed())
