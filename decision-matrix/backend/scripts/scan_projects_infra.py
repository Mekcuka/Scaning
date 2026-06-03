#!/usr/bin/env python3
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import func, select

from app.core.database import async_session
from app.models import InfrastructureLayer, InfrastructureObject, Project

EXCLUDED = {"node", "methanol_joint", "power_line_node"}


async def main() -> None:
    async with async_session() as db:
        projects = (await db.execute(select(Project).order_by(Project.name))).scalars().all()
        report = []
        for p in projects:
            objs = (
                await db.execute(
                    select(InfrastructureObject)
                    .join(InfrastructureLayer)
                    .where(InfrastructureLayer.project_id == p.id)
                )
            ).scalars().all()
            terms = [
                o
                for o in objs
                if o.category == "point" and o.subtype not in EXCLUDED
            ]
            roads = [o for o in objs if o.subtype == "autoroad"]
            report.append(
                {
                    "id": str(p.id),
                    "name": p.name,
                    "total": len(objs),
                    "terminals": len(terms),
                    "autoroads": len(roads),
                    "categories": sorted({o.category for o in objs}),
                }
            )
    out = Path(__file__).resolve().parent.parent / "data" / "projects_infra_scan.json"
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    for r in report:
        print(f"{r['name']}: terminals={r['terminals']} roads={r['autoroads']} cats={r['categories']}")


if __name__ == "__main__":
    asyncio.run(main())
