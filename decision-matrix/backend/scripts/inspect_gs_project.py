"""Inspect GS bottomholes and trajectories for a project."""
import asyncio
import json
import sys
from uuid import UUID

from sqlalchemy import select

from app.core.database import async_session
from app.models import InfrastructureLayer, InfrastructureObject
from app.services.well_trajectory.bottomhole_properties import (
    read_gs_entry_mode,
    read_gs_line_endpoints,
    resolve_well_index,
)
from app.services.well_trajectory.trajectory_store import read_trajectories_json


async def main(project_id: str) -> None:
    pid = UUID(project_id)
    async with async_session() as db:
        q = select(InfrastructureObject).join(InfrastructureLayer).where(InfrastructureLayer.project_id == pid)
        rows = list((await db.execute(q)).scalars().all())
        print("objects", len(rows))
        pads = [o for o in rows if "pad" in (o.subtype or "")]
        bhs = [o for o in rows if "bottomhole" in (o.subtype or "")]
        for p in pads:
            print("PAD", p.name, p.id)
            tr = read_trajectories_json(p.properties)
            print(" trajectories", len(tr))
            for w in tr:
                idx = w.get("well_index")
                t = w.get("target") or {}
                d = w.get("design") or {}
                print(
                    f"  well {idx}: profile={t.get('profile')} "
                    f"target_mode={t.get('gs_entry_mode')} "
                    f"design_mode={d.get('gs_entry_mode')} "
                    f"offset={d.get('gs_entry_offset_m')}"
                )
                if idx == 1:
                    print("   target", json.dumps(t, ensure_ascii=False, indent=2)[:1200])
                    print("   design", json.dumps(d, ensure_ascii=False, indent=2)[:600])
        print("--- bottomholes ---")
        for o in sorted(bhs, key=lambda x: (x.name or "")):
            pad = next((p for p in pads if p), None)
            wi = resolve_well_index(pad, o) if pad else None
            mode = read_gs_entry_mode(o.properties)
            print(o.name, o.subtype, "well_idx", wi, "entry_mode", mode)
            if o.subtype == "well_bottomhole_gs":
                ep = read_gs_line_endpoints(o)
                if ep:
                    print(
                        "  heel", ep["heelLon"], ep["heelLat"],
                        "toe", ep["toeLon"], ep["toeLat"],
                    )


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "cffb274b-1f05-4332-b8f9-3700b7f075f8"))
