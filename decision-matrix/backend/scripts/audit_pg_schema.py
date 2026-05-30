"""Compare live PostgreSQL schema against SQLAlchemy models. Exit 1 if mismatches."""

from __future__ import annotations

import asyncio
import sys

from sqlalchemy import inspect

# Ensure app models are registered on Base.metadata
from app.core.database import Base, engine  # noqa: F401
from app.models import (  # noqa: F401
    ImportConnection,
    ImportLog,
    InfrastructureEdge,
    InfrastructureLayer,
    InfrastructureNetwork,
    InfrastructureNode,
    InfrastructureObject,
    OnePager,
    PointOfInterest,
    PoiFlowSchematicLayout,
    PoiInfrastructureAnalysis,
    Project,
    ProjectCostRates,
    ProjectDistanceDefaults,
    ProjectEconomicParams,
    User,
)


def expected_schema() -> dict[str, set[str]]:
    out: dict[str, set[str]] = {}
    for table in Base.metadata.sorted_tables:
        out[table.name] = {col.name for col in table.columns}
    return out


POSTGIS_EXTRA_TABLES = frozenset(
    {
        "spatial_ref_sys",
        "alembic_version",
        "topology",
        "layer",
        "addr",
        "addrfeat",
        "bg",
        "county",
        "county_lookup",
        "countysub_lookup",
        "cousub",
        "direction_lookup",
        "edges",
        "faces",
        "featnames",
        "geocode_settings",
        "geocode_settings_default",
        "loader_lookuptables",
        "loader_platform",
        "loader_variables",
        "pagc_gaz",
        "pagc_lex",
        "pagc_rules",
        "place",
        "place_lookup",
        "secondary_unit_lookup",
        "state",
        "state_lookup",
        "street_type_lookup",
        "tabblock",
        "tabblock20",
        "tract",
        "zcta5",
        "zip_lookup",
        "zip_lookup_all",
        "zip_lookup_base",
        "zip_state",
        "zip_state_loc",
    }
)


async def live_schema() -> dict[str, set[str]]:
    async with engine.connect() as conn:

        def _read(sync_conn):
            insp = inspect(sync_conn)
            return {
                name: {c["name"] for c in insp.get_columns(name)}
                for name in sorted(insp.get_table_names())
                if name not in POSTGIS_EXTRA_TABLES
            }

        return await conn.run_sync(_read)


async def main() -> int:
    expected = expected_schema()
    live = await live_schema()

    missing_tables = sorted(set(expected) - set(live))
    extra_tables = sorted(set(live) - set(expected))
    missing_cols: list[tuple[str, str]] = []
    extra_cols: list[tuple[str, str]] = []

    for table, cols in sorted(expected.items()):
        if table not in live:
            continue
        live_cols = live[table]
        for col in sorted(cols - live_cols):
            missing_cols.append((table, col))
        for col in sorted(live_cols - cols):
            extra_cols.append((table, col))

    ok = not missing_tables and not missing_cols
    print("=== PostgreSQL schema audit ===")
    print(f"Expected tables: {len(expected)}")
    print(f"Live tables:     {len(live)}")

    if missing_tables:
        print("\nMISSING TABLES:")
        for t in missing_tables:
            print(f"  - {t}")

    if extra_tables:
        print("\nEXTRA TABLES (not in models):")
        for t in extra_tables:
            print(f"  - {t}")

    if missing_cols:
        print("\nMISSING COLUMNS:")
        for t, c in missing_cols:
            print(f"  - {t}.{c}")

    if extra_cols:
        print("\nEXTRA COLUMNS (in DB, not in models):")
        for t, c in extra_cols:
            print(f"  - {t}.{c}")

    if ok and not extra_tables and not extra_cols:
        print("\nOK: schema matches models.")
        return 0

    if ok:
        print("\nOK: all model tables/columns present (extra DB objects listed above).")
        return 0

    print("\nFAIL: schema drift detected.")
    return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
