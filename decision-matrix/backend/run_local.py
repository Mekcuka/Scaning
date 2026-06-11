#!/usr/bin/env python3
"""Локальный запуск с SQLite: init DB, seed, uvicorn."""
import asyncio
import os
import socket
import subprocess
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
DEV_PORT_FILE = BACKEND_DIR / ".dev-port"
PREFERRED_PORT = int(os.environ.get("SPPR_LOCAL_PORT", "8000"))
PORT_SCAN_MAX = 20

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./data/sppr.db"
os.environ["ENVIRONMENT"] = "development"
os.environ["AUTH_RATE_LIMIT"] = "1000/minute"


def _pids_on_port(port: int) -> set[str]:
    if sys.platform != "win32":
        return set()
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
    return pids


def _process_exists(pid: str) -> bool:
    if sys.platform != "win32":
        return True
    rc = subprocess.run(
        ["tasklist", "/FI", f"PID eq {pid}"],
        capture_output=True,
        text=True,
        check=False,
    )
    return f" {pid} " in rc.stdout


def free_listening_port(port: int) -> None:
    """Stop processes listening on *port* (Windows dev: stale uvicorn reloaders)."""
    if sys.platform != "win32":
        return
    for pid in sorted(_pids_on_port(port), key=int):
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", pid],
            capture_output=True,
            check=False,
        )


def _kill_backend_python_processes() -> None:
    """Stop stray run_local / uvicorn from this repo (multiple dev sessions)."""
    if sys.platform != "win32":
        return
    marker = str(BACKEND_DIR).lower()
    ps = (
        "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | "
        f"Where-Object {{ $_.CommandLine -and $_.CommandLine.ToLower().Contains('{marker.replace(chr(92), chr(92)+chr(92))}') }} | "
        "ForEach-Object { $_.ProcessId }"
    )
    rc = subprocess.run(
        ["powershell", "-NoProfile", "-Command", ps],
        capture_output=True,
        text=True,
        check=False,
    )
    for line in rc.stdout.splitlines():
        pid = line.strip()
        if pid.isdigit():
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", pid],
                capture_output=True,
                check=False,
            )


def port_can_bind(port: int) -> bool:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind(("127.0.0.1", port))
        return True
    except OSError:
        return False
    finally:
        sock.close()


def pick_local_port(preferred: int) -> int:
    _kill_backend_python_processes()
    for port in range(preferred, preferred + PORT_SCAN_MAX):
        free_listening_port(port)
        stale = [pid for pid in _pids_on_port(port) if not _process_exists(pid)]
        if stale:
            print(
                f"WARNING: port {port} has stale listener(s) {', '.join(stale)} "
                "(old backend without updated code). Trying next port."
            )
            continue
        if port_can_bind(port):
            return port
    raise RuntimeError(
        f"No free port in range {preferred}-{preferred + PORT_SCAN_MAX - 1}. "
        "Close other backends or reboot to clear stale port 8000."
    )


def write_dev_port(port: int) -> None:
    DEV_PORT_FILE.write_text(f"{port}\n", encoding="utf-8")


async def init_db():
    sys.path.insert(0, str(BACKEND_DIR))
    from app.main import app, lifespan  # noqa: F401

    async with lifespan(app):
        pass


def ensure_pad_earthwork_planner() -> None:
    """Install pad-earthwork-planner from monorepo sibling if missing."""
    try:
        import pad_earthwork  # noqa: F401
        return
    except ImportError:
        pass
    planner_dir = BACKEND_DIR.parent.parent / "pad-earthwork-planner"
    if not planner_dir.is_dir():
        print(
            "WARNING: pad-earthwork-planner not installed and not found at",
            planner_dir,
            "— pad earthwork compute will fail until you run:",
            "pip install -e ../../../pad-earthwork-planner",
        )
        return
    print("Installing pad-earthwork-planner (editable)...")
    subprocess.run(
        [sys.executable, "-m", "pip", "install", "-e", str(planner_dir)],
        cwd=BACKEND_DIR,
        check=True,
    )


def main():
    sys.path.insert(0, str(BACKEND_DIR))
    ensure_pad_earthwork_planner()
    print("Initializing SQLite database...")
    asyncio.run(init_db())
    print("Seeding demo data...")
    subprocess.run([sys.executable, "seed.py"], cwd=BACKEND_DIR, check=True)
    local_port = pick_local_port(PREFERRED_PORT)
    write_dev_port(local_port)
    if local_port != PREFERRED_PORT:
        print(
            f"NOTE: Vite proxy reads backend/.dev-port — restart `npm run dev` if it was already running."
        )
    print(f"Starting backend on http://localhost:{local_port}")
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
            str(local_port),
        ],
        cwd=BACKEND_DIR,
        env=env,
    )


if __name__ == "__main__":
    main()
