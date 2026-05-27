"""Verify GKS (gas_processing) environment analysis against haversine nearest Point."""
import asyncio
import math
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import os

BASE = os.environ.get("API_BASE", "http://127.0.0.1:8000/api/v1")


def haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def main() -> int:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(
            f"{BASE}/auth/login",
            json={"email": "engineer@oilgas.ru", "password": "password123"},
        )
        if r.status_code != 200:
            print("Backend unavailable:", r.status_code, r.text)
            return 1
        h = {"Authorization": f"Bearer {r.json()['access_token']}"}
        pid = (await c.get(f"{BASE}/projects", headers=h)).json()[0]["id"]
        pois = (await c.get(f"{BASE}/projects/{pid}/pois", headers=h)).json()
        poi = pois[0]
        infra = (
            await c.get(
                f"{BASE}/projects/{pid}/infrastructure/objects",
                headers=h,
                params={"visible_layers_only": "false"},
            )
        ).json()
        gks_list = [o for o in infra if o.get("subtype") == "gas_processing"]

        print("=== POI ===")
        print(poi["name"], f"lon={poi['lon']}, lat={poi['lat']}")
        print("threshold_gas_processing_km:", poi.get("threshold_gas_processing_km"))

        print("\n=== GKS objects on map ===")
        ranked = []
        for o in gks_list:
            d = haversine_km(poi["lon"], poi["lat"], o["lon"], o["lat"])
            ranked.append((d, o))
            print(f"  {o['name']}: ({o['lon']}, {o['lat']}) -> {d:.2f} km")
        ranked.sort(key=lambda x: x[0])
        if not ranked:
            print("No GKS points — import infrastructure_test_import.csv")
            return 1
        best_d, best = ranked[0]
        limit = poi.get("threshold_gas_processing_km") or 80
        if best_d <= limit:
            exp_status = "within_limit"
        else:
            exp_status = "exceeds_limit"

        print(f"\nExpected nearest: {best['name']} @ {best_d:.2f} km, status={exp_status} (limit {limit})")

        an = await c.post(f"{BASE}/projects/{pid}/pois/{poi['id']}/analyze", headers=h)
        an.raise_for_status()
        data = an.json()
        rows = data.get("rows") or data.get("analysis") or []
        row = next((r for r in rows if r.get("subtype") == "gas_processing"), None)
        print("\n=== API analysis (gas_processing) ===")
        print(row)

        ok = True
        if not row:
            print("FAIL: no gas_processing row")
            return 1
        if row.get("object_name") != best["name"]:
            print(f"FAIL: object_name {row.get('object_name')!r} != {best['name']!r}")
            ok = False
        api_d = row.get("distance_km")
        if api_d is not None and abs(api_d - round(best_d, 1)) > 0.15:
            print(f"FAIL: distance_km {api_d} vs expected ~{round(best_d, 1)}")
            ok = False
        if row.get("status") != exp_status:
            print(f"FAIL: status {row.get('status')} vs expected {exp_status}")
            ok = False
        if row.get("limit_km") != round(limit, 1) and row.get("limit_km") != limit:
            print(f"WARN: limit_km {row.get('limit_km')} vs POI threshold {limit}")
        if row.get("cost_mln") != 500.0 and row.get("status") not in ("not_required",):
            print(f"INFO: cost_mln={row.get('cost_mln')} (rate 500 mln for external GKS)")

        if ok:
            print("\nOK: GKS analysis matches expected nearest Point logic")
            return 0
        return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
