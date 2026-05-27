#!/usr/bin/env python3
"""Локальный запуск с SQLite: init DB, seed, uvicorn."""
import asyncio
import os
import subprocess
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./data/sppr.db"


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
    print("Starting backend on http://localhost:8000")
    subprocess.run(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--reload", "--host", "127.0.0.1", "--port", "8000"],
        cwd=BACKEND_DIR,
    )


if __name__ == "__main__":
    main()
