#!/usr/bin/env python3
import asyncio
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select

from app.core.database import async_session
from app.geo.constants import NODE_CLUSTER_SUBTYPES, POINT_SUBTYPES
from app.models import InfrastructureLayer, InfrastructureObject, Project


async def main() -> None:
    async with async_session() as db:
        for p in (await db.execute(select(Project).order_by(Project.name))).scalars():
            objs = (
                await db.execute(
                    select(InfrastructureObject)
                    .join(InfrastructureLayer)
                    .where(InfrastructureLayer.project_id == p.id)
                )
            ).scalars().all()
            eligible = [
                o
                for o in objs
                if o.subtype in POINT_SUBTYPES
                and o.subtype not in NODE_CLUSTER_SUBTYPES
                and o.end_longitude is None
            ]
            roads = [o for o in objs if o.subtype == "autoroad"]
            if not eligible and not roads:
                continue
            print(f"\n== {p.name} ({p.id}) ==")
            print(f"  eligible terminals: {len(eligible)}, autoroads: {len(roads)}")
            for o in eligible[:8]:
                print(f"    {o.name} {o.subtype} cat={o.category}")
            if len(eligible) > 8:
                print(f"    ... +{len(eligible)-8}")


if __name__ == "__main__":
    asyncio.run(main())
