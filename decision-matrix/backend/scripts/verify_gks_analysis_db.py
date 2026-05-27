"""Run GKS analysis in-process (current code) against local SQLite."""
import asyncio
import math
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./data/sppr.db")

from sqlalchemy import select

from app.core.database import async_session
from app.models import InfrastructureLayer, InfrastructureObject, PointOfInterest, Project
from app.services.infrastructure_analysis import run_poi_analysis
from app.services.spatial import haversine_km


async def main() -> int:
    async with async_session() as db:
        project = await db.scalar(select(Project).limit(1))
        if not project:
            print("No project in DB")
            return 1
        poi = await db.scalar(
            select(PointOfInterest).where(PointOfInterest.project_id == project.id).limit(1)
        )
        if not poi:
            print("No POI")
            return 1
        layer_ids = select(InfrastructureLayer.id).where(InfrastructureLayer.project_id == project.id)
        gks = (
            await db.execute(
                select(InfrastructureObject).where(
                    InfrastructureObject.layer_id.in_(layer_ids),
                    InfrastructureObject.subtype == "gas_processing",
                    InfrastructureObject.end_longitude.is_(None),
                )
            )
        ).scalars().all()

        print(f"POI: {poi.name} ({poi.longitude}, {poi.latitude})")
        print(f"threshold_gas_processing_km: {poi.threshold_gas_processing_km}")
        ranked = []
        for o in gks:
            d = haversine_km(poi.longitude, poi.latitude, o.longitude, o.latitude)
            ranked.append((d, o))
            print(f"  GKS {o.name}: {d:.2f} km")
        ranked.sort(key=lambda x: x[0])
        best_d, best = ranked[0] if ranked else (None, None)

        result = await run_poi_analysis(db, project.id, poi)
        await db.commit()
        row = next(r for r in result["rows"] if r["subtype"] == "gas_processing")
        print("\nrun_poi_analysis gas_processing:")
        print(row)

        ok = True
        if best and row.get("object_name") != best.name:
            print(f"FAIL name: {row.get('object_name')} != {best.name}")
            ok = False
        if row.get("anchor_type") == "network_node":
            print("FAIL still using network_node anchor")
            ok = False
        if best and row.get("distance_km") is not None:
            if abs(row["distance_km"] - round(best_d, 1)) > 0.2:
                print(f"FAIL distance {row['distance_km']} vs {round(best_d, 1)}")
                ok = False
        limit = poi.threshold_gas_processing_km or 80
        exp_st = "within_limit" if best_d <= limit else "exceeds_limit"
        if row.get("status") != exp_st:
            print(f"FAIL status {row.get('status')} vs {exp_st}")
            ok = False
        if ok:
            print("\nOK")
            return 0
        return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
