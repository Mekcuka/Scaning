"""
Merge default render_3d_* keys into infrastructure_objects.properties.

Usage:
  python scripts/backfill_render_3d_properties.py --dry-run
  python scripts/backfill_render_3d_properties.py --project-id <uuid>
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path
from uuid import UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.core.database import async_session
from app.geo.render_3d_properties import apply_default_render_3d
from app.models import InfrastructureObject


async def run(project_id: UUID | None, dry_run: bool) -> None:
    updated = 0
    async with async_session() as db:
        q = select(InfrastructureObject)
        if project_id:
            from app.models import InfrastructureLayer

            q = q.join(InfrastructureLayer).where(InfrastructureLayer.project_id == project_id)
        rows = (await db.execute(q)).scalars().all()
        for obj in rows:
            before = dict(obj.properties or {})
            after = apply_default_render_3d(obj.subtype, before)
            if after != before:
                updated += 1
                if not dry_run:
                    obj.properties = after
        if not dry_run:
            await db.commit()
    mode = "dry-run" if dry_run else "committed"
    print(f"{mode}: {updated} objects would update / updated")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--project-id", type=UUID, default=None)
    args = parser.parse_args()
    asyncio.run(run(args.project_id, args.dry_run))


if __name__ == "__main__":
    main()
