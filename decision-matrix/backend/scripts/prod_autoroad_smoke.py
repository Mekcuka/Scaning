#!/usr/bin/env python3
"""Smoke test autoroad-network pipeline on prod."""
from __future__ import annotations

import os
import sys

import httpx

API = os.environ.get("SPPR_API", "https://erascaning.duckdns.org/api/v1")
EMAIL = os.environ.get("SPPR_TEST_EMAIL", "engineer@oilgas.ru")
PASSWORD = os.environ.get("SPPR_TEST_PASSWORD", "password123")
EXCLUDED = {"node", "methanol_joint", "power_line_node"}


def main() -> None:
    with httpx.Client(base_url=API, timeout=120.0, follow_redirects=True) as c:
        r = c.post("/auth/login", json={"email": EMAIL, "password": PASSWORD})
        print("login", r.status_code)
        r.raise_for_status()
        h = {
            "Authorization": f"Bearer {r.json()['access_token']}",
            "X-CSRF-Token": r.headers.get("X-CSRF-Token", ""),
        }
        projects = c.get("/projects", headers=h).json()
        print("projects", len(projects))
        best = None
        for p in projects:
            pid = p["id"]
            objs = c.get(
                f"/projects/{pid}/infrastructure/objects",
                headers=h,
                params={"visible_layers_only": "false"},
            ).json()
            if objs:
                print(" sample keys", list(objs[0].keys())[:12], "subtype", objs[0].get("subtype"))
            terms = [
                o
                for o in objs
                if o.get("subtype") not in EXCLUDED
                and not o.get("end_lon")
                and not o.get("coordinates") or (isinstance(o.get("coordinates"), list) and len(o.get("coordinates") or []) <= 1)
            ]
            # Point: no line end (API uses end_lon; legacy end_longitude)
            terms = [
                o
                for o in objs
                if o.get("subtype") not in EXCLUDED
                and not (o.get("end_lon") or o.get("end_longitude"))
            ]
            print(" ", p["name"][:30], "terms", len(terms), "total", len(objs))
            if best is None or len(terms) > len(best[2]):
                best = (pid, p["name"], terms)
        assert best is not None
        pid, pname, terms = best
        print("project", pname, pid, "terminals", len(terms))
        if len(terms) < 2:
            sys.exit("need 2 terminals")
        ids = [terms[0]["id"], terms[1]["id"]]
        req = c.post(
            f"/projects/{pid}/autoroad-network/request",
            json={"object_ids": ids, "full_network_rebuild": True},
            headers=h,
        )
        print("request", req.status_code, req.text[:300] if req.status_code != 200 else "ok")
        req.raise_for_status()
        body = req.json()
        comp = c.post(
            f"/projects/{pid}/autoroad-network/compute",
            json=body,
            headers=h,
        )
        print("compute", comp.status_code)
        if comp.status_code != 200:
            print(comp.text[:1000])
            comp.raise_for_status()
        plan = comp.json()
        print(
            "plan",
            plan.get("total_new_km"),
            "lines",
            plan.get("new_line_count"),
            "warnings",
            plan.get("warnings", [])[:5],
        )
        apply = c.post(
            f"/projects/{pid}/autoroad-network/apply",
            json={"object_ids": ids, "plan": plan, "full_network_rebuild": True},
            headers=h,
        )
        print("apply", apply.status_code)
        print(apply.text[:800])


if __name__ == "__main__":
    main()
