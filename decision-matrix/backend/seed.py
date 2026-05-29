"""Seed demo data for development."""
import asyncio

from sqlalchemy import select, text

from app.core.config import settings
from app.core.database import async_session
from app.core.security import get_password_hash
from app.geo.geometry_utils import build_infra_geometry, point_wkt
from app.models import (
    InfrastructureLayer,
    InfrastructureObject,
    PointOfInterest,
    Project,
    ProjectCostRates,
    ProjectDistanceDefaults,
    ProjectEconomicParams,
    Scenario,
    User,
)
from app.services.cost_rates import DEFAULT_COST_RATES
from app.services.economic_rates import DEFAULT_ECONOMIC_PARAMS


async def seed():
    from app.core.database import Base, engine

    async with engine.begin() as conn:
        if not settings.is_sqlite:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        existing = await db.execute(select(User).where(User.email == "engineer@oilgas.ru"))
        if existing.scalar_one_or_none():
            print("Seed data already exists")
            return

        user = User(
            email="engineer@oilgas.ru",
            username="Иванов И.И.",
            password_hash=get_password_hash("password123"),
            role="analyst",
        )
        db.add(user)
        await db.flush()

        project = Project(
            user_id=user.id,
            name="Участок Западный",
            description="Разработка западного участка",
            status="active",
        )
        db.add(project)
        await db.flush()

        db.add(ProjectCostRates(project_id=project.id, rates=dict(DEFAULT_COST_RATES)))
        db.add(ProjectEconomicParams(project_id=project.id, params=dict(DEFAULT_ECONOMIC_PARAMS)))
        db.add(ProjectDistanceDefaults(project_id=project.id))
        db.add(Scenario(project_id=project.id, name="Базовый", scenario_type="base"))
        db.add(Scenario(project_id=project.id, name="Сценарий 1", scenario_type="scenario"))
        db.add(Scenario(project_id=project.id, name="Сценарий 2", scenario_type="scenario", is_manual=True))

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
        print(f"Seed OK: engineer@oilgas.ru / password123 (project id: {project.id})")


if __name__ == "__main__":
    asyncio.run(seed())
