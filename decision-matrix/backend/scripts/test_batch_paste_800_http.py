"""HTTP repro against live uvicorn."""
import json
import http.cookiejar
import os
import sys
import urllib.request

PORT = int(sys.argv[1] if len(sys.argv) > 1 else os.environ.get("SPPR_LOCAL_PORT", "8000"))
BASE = f"http://127.0.0.1:{PORT}/api/v1"
PROJECT = "51e47609-ead3-4c8b-999e-966de8ddddf0"


class Opener:
    def __init__(self) -> None:
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def call(self, method: str, path: str, body=None, headers=None):
        h = {"Content-Type": "application/json", **(headers or {})}
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(f"{BASE}{path}", data=data, headers=h, method=method)
        try:
            with self.opener.open(req, timeout=120) as resp:
                return resp.status, json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            raw = e.read().decode()
            try:
                detail = json.loads(raw)
            except json.JSONDecodeError:
                detail = raw[:3000]
            return e.code, detail

    def csrf(self) -> dict[str, str]:
        for c in self.jar:
            if c.name == "csrf_token":
                return {"X-CSRF-Token": c.value}
        return {}


def main() -> None:
    print(f"testing http://127.0.0.1:{PORT}")
    api = Opener()
    code, login = api.call(
        "POST",
        "/auth/login",
        {"email": "engineer@oilgas.ru", "password": "password123"},
    )
    print("login", code, login if code != 200 else "ok")
    if code != 200:
        return

    code, layers = api.call("GET", f"/projects/{PROJECT}/infrastructure/layers", headers=api.csrf())
    print("layers", code)
    if code != 200:
        print(layers)
        return
    layer_id = layers[0]["id"]

    payload = {
        "pois": [],
        "infra_points": [
            {
                "client_ref": f"n{i}",
                "create": {
                    "name": f"HTTP_N_{i}",
                    "subtype": "node",
                    "lon": 37.6 + i * 0.00001,
                    "lat": 55.75,
                    "layer_id": layer_id,
                },
            }
            for i in range(800)
        ],
        "infra_lines": [],
    }
    code, result = api.call(
        "POST",
        f"/projects/{PROJECT}/map/batch-paste",
        payload,
        headers=api.csrf(),
    )
    print("batch-paste", code)
    if code == 200:
        print("created_infra", len(result.get("created_infra", [])))
    else:
        print(json.dumps(result, ensure_ascii=False)[:3000])


if __name__ == "__main__":
    main()
