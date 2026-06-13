#!/usr/bin/env python3
"""Local dev server without prior pip install (adds src/ to PYTHONPATH)."""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
PORT = "8082"


def main() -> None:
    env = dict(**{k: v for k, v in __import__("os").environ.items()})
    env["PYTHONPATH"] = str(SRC) + (
        (";" + env["PYTHONPATH"]) if env.get("PYTHONPATH") else ""
    )
    subprocess.run(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "well_trajectory.api:app",
            "--reload",
            "--host",
            "127.0.0.1",
            "--port",
            PORT,
        ],
        cwd=ROOT,
        env=env,
        check=True,
    )


if __name__ == "__main__":
    main()
