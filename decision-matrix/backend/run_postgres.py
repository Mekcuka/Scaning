#!/usr/bin/env python3
"""Run API against PostgreSQL from backend/.env (PostGIS)."""
import subprocess
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent


def main() -> None:
    env_file = BACKEND_DIR / ".env"
    if not env_file.is_file():
        print("Missing backend/.env. Run: .\\scripts\\setup_postgres.ps1 -SuperuserPassword <postgres_password>")
        sys.exit(1)
    print("Starting backend on http://127.0.0.1:8000 (DATABASE_URL from .env)")
    subprocess.run(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--reload", "--host", "127.0.0.1", "--port", "8000"],
        cwd=BACKEND_DIR,
        check=True,
    )


if __name__ == "__main__":
    main()
