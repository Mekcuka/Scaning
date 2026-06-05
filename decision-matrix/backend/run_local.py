#!/usr/bin/env python3
"""Локальный запуск с SQLite: init DB, seed, uvicorn."""
import asyncio
import os
import subprocess
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
LOCAL_PORT = int(os.environ.get("SPPR_LOCAL_PORT", "8000"))

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./data/sppr.db"
os.environ["ENVIRONMENT"] = "development"
os.environ["AUTH_RATE_LIMIT"] = "1000/minute"


def free_listening_port(port: int) -> None:
    """Stop processes listening on *port* (Windows dev: stale uvicorn reloaders)."""
    if sys.platform != "win32":
        return
    out = subprocess.run(
        ["netstat", "-ano"],
        capture_output=True,
        text=True,
        check=False,
    ).stdout
    pids: set[str] = set()
    token = f":{port}"
    for line in out.splitlines():
        if token not in line or "LISTENING" not in line:
            continue
        parts = line.split()
        if parts and parts[-1].isdigit():
            pids.add(parts[-1])
    for pid in sorted(pids, key=int):
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", pid],
            capture_output=True,
            check=False,
        )


async def init_db():
    sys.path.insert(0, str(BACKEND_DIR))
    from app.main import app, lifespan  # noqa: F401

    async with lifespan(app):
        pass


def main():
    sys.path.insert(0, str(BACKEND_DIR))
    print("Initializing SQLite database...")
    asyncio.run(init_db())
    print("Seeding demo data...")
    subprocess.run([sys.executable, "seed.py"], cwd=BACKEND_DIR, check=True)
    free_listening_port(LOCAL_PORT)
    print(f"Starting backend on http://localhost:{LOCAL_PORT}")
    env = os.environ.copy()
    env.setdefault("ENVIRONMENT", "development")
    env.setdefault("AUTH_RATE_LIMIT", "1000/minute")
    subprocess.run(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--reload",
            "--host",
            "127.0.0.1",
            "--port",
            str(LOCAL_PORT),
        ],
        cwd=BACKEND_DIR,
        env=env,
    )


if __name__ == "__main__":
    main()
