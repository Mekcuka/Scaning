"""Verify prod dem/fetch and dem/preview."""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

MCP = Path(__file__).resolve().parents[2] / ".cursor" / "mcp.json"
BASE = "https://erascaning.duckdns.org/api/v1"


def req(token: str, method: str, path: str, body: dict | None = None) -> tuple[int, dict]:
    data = None if body is None else json.dumps(body).encode()
    r = urllib.request.Request(
        BASE + path,
        data=data,
        method=method,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(r, timeout=180) as resp:
            raw = resp.read()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"detail": raw.decode()[:300]}


def main() -> int:
    token = json.loads(MCP.read_text(encoding="utf-8"))["mcpServers"]["atlas-grid"]["headers"][
        "Authorization"
    ].replace("Bearer ", "")
    project_id = json.loads(json.dumps(req(token, "GET", "/projects")[1]))[0]["id"]
    st, obj = req(
        token,
        "POST",
        f"/projects/{project_id}/infrastructure/objects",
        {
            "name": "_dem_api_check",
            "subtype": "oil_pad",
            "lon": 37.62,
            "lat": 55.76,
            "properties": {
                "pad_length_m": 80,
                "pad_width_m": 60,
                "pad_height_m": 2,
                "pad_reference_elevation_m": 100,
            },
        },
    )
    print("create", st)
    if st not in (200, 201):
        print(obj)
        return 1
    oid = obj["id"]
    params = {"params": {"length_m": 80, "width_m": 60, "height_m": 2, "reference_elevation_m": 100}}
    st, fetch = req(token, "POST", f"/projects/{project_id}/infrastructure/objects/{oid}/pad-earthwork/dem/fetch", params)
    print("dem/fetch", st, fetch if st != 200 else {"source": fetch.get("source"), "dem_asset_id": fetch.get("dem_asset_id")})
    st, preview = req(
        token, "POST", f"/projects/{project_id}/infrastructure/objects/{oid}/pad-earthwork/dem/preview", params
    )
    print("dem/preview", st)
    if st == 200:
        print(
            "grid",
            preview["cols"],
            "x",
            preview["rows"],
            "footprint_elev_min",
            preview["footprint_elev_min"],
        )
    else:
        print(preview)
    st, _ = req(token, "DELETE", f"/projects/{project_id}/infrastructure/objects/{oid}")
    print("delete", st)
    return 0 if st in (200, 204) and preview else 1


if __name__ == "__main__":
    raise SystemExit(main())
