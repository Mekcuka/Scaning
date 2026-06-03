#!/usr/bin/env python3
"""Live autoroad-network test for project Р1 (login + plan + optional apply)."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from uuid import UUID

import httpx

BACKEND = "http://127.0.0.1:8000"
API = f"{BACKEND}/api/v1"
EMAIL = os.environ.get("SPPR_TEST_EMAIL", "admin@oilgas.ru")
PASSWORD = os.environ.get("SPPR_TEST_PASSWORD", "admin1234")
# Cyrillic Р1 or Latin P1 (часто в UI)
PROJECT_ALIASES = ("\u04201", "P1", "R1", "\u04201 ")
APPLY = "--apply" in sys.argv
EXCLUDED_SUBTYPES = {"node", "methanol_joint", "power_line_node"}


def login(client: httpx.Client) -> dict[str, str]:
    res = client.post("/auth/login", json={"email": EMAIL, "password": PASSWORD})
    res.raise_for_status()
    return {
        "Authorization": f"Bearer {res.json()['access_token']}",
        "X-CSRF-Token": res.headers.get("X-CSRF-Token", ""),
    }


def resolve_project(
    client: httpx.Client, headers: dict[str, str]
) -> tuple[UUID, str, list[tuple[UUID, str, str, float, float]], int]:
    projects = client.get("/projects", headers=headers).json()
    names = {p["name"]: p for p in projects}
    candidates: list[dict] = []
    for alias in PROJECT_ALIASES:
        if alias in names:
            candidates.append(names[alias])
    for p in projects:
        n = (p.get("name") or "").strip()
        if len(n) >= 2 and n[-1] == "1" and n[0] in ("P", "R", "\u0420"):
            if p not in candidates:
                candidates.append(p)
    if not candidates:
        available = ", ".join(f"{x['name']!r}" for x in projects)
        raise SystemExit(f"Project Р1/P1 not found for {EMAIL}. Available: {available}")

    best: tuple[UUID, str, list, int] | None = None
    for p in candidates:
        pid = UUID(p["id"])
        terms, roads = fetch_infra(client, headers, pid)
        if len(terms) >= 2:
            return pid, p["name"], terms, roads
        if best is None or len(terms) > len(best[2]):
            best = (pid, p["name"], terms, roads)
    assert best is not None
    return best[0], best[1], best[2], best[3]


def fetch_infra(
    client: httpx.Client, headers: dict[str, str], project_id: UUID
) -> tuple[list[tuple[UUID, str, str, float, float]], int]:
    objs = client.get(
        f"/projects/{project_id}/infrastructure/objects",
        headers=headers,
        params={"visible_layers_only": "false"},
    ).json()
    terminals: list[tuple[UUID, str, str, float, float]] = []
    roads = 0
    for o in objs:
        if o.get("subtype") == "autoroad":
            roads += 1
        if o.get("category") != "point":
            continue
        subtype = o.get("subtype") or ""
        if subtype in EXCLUDED_SUBTYPES:
            continue
        terminals.append(
            (
                UUID(o["id"]),
                subtype,
                o.get("name") or "",
                float(o.get("longitude") or 0),
                float(o.get("latitude") or 0),
            )
        )
    return terminals, roads


def main() -> None:
    with httpx.Client(base_url=API, timeout=120.0, follow_redirects=True) as client:
        headers = login(client)
        project_id, project_name, terminals, road_count = resolve_project(client, headers)

    print(f"Project: {project_name} ({project_id})")
    print(f"Autoroad lines on map: {road_count}")
    print(f"Point terminals (excl. node cluster): {len(terminals)}")
    for t in terminals[:10]:
        print(f"  - {t[2]} ({t[1]}) {t[3]:.5f},{t[4]:.5f}")
    if len(terminals) > 10:
        print(f"  ... +{len(terminals) - 10} more")

    if len(terminals) < 2:
        raise SystemExit("Need at least 2 terminals for autoroad network test")

    object_ids = [str(t[0]) for t in terminals[: min(6, len(terminals))]]
    print(f"Using {len(object_ids)} terminals for plan")

    with httpx.Client(base_url=API, timeout=120.0, follow_redirects=True) as client:
        headers = login(client)

        plan = client.post(
            f"/projects/{project_id}/autoroad-network/plan",
            json={"object_ids": object_ids, "dry_run": True},
            headers=headers,
        )
        print(f"\nPOST plan -> {plan.status_code}")
        if plan.status_code == 404:
            plan = client.post(
                f"/projects/{project_id}/infrastructure/autoroad-connect",
                json={"object_ids": object_ids, "dry_run": True},
                headers=headers,
            )
            print(f"POST autoroad-connect (fallback) -> {plan.status_code}")
        plan.raise_for_status()
        data = plan.json()
        print(json.dumps(
            {
                "dry_run": data.get("dry_run"),
                "new_line_count": data.get("new_line_count"),
                "new_node_count": data.get("new_node_count"),
                "split_count": data.get("split_count"),
                "total_new_km": data.get("total_new_km"),
                "warnings": data.get("warnings", [])[:8],
                "terminals": [
                    {
                        "name": t.get("name"),
                        "subtype": t.get("subtype"),
                        "warning": t.get("warning"),
                        "graph_attached": t.get("graph_attached") or bool(t.get("graph_node_id")),
                    }
                    for t in data.get("terminals", [])
                ],
            },
            ensure_ascii=False,
            indent=2,
        ))

        if APPLY:
            apply = client.post(
                f"/projects/{project_id}/autoroad-network/apply",
                json={"object_ids": object_ids, "dry_run": False},
                headers=headers,
            )
            print(f"\nPOST apply -> {apply.status_code}")
            apply.raise_for_status()
            print(json.dumps(apply.json(), ensure_ascii=False, indent=2)[:2000])
        else:
            print("\n(dry-run only; pass --apply to write to DB)")


if __name__ == "__main__":
    main()
