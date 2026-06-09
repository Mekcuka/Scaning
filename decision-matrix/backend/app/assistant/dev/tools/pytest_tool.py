"""run_pytest dev tool."""

from __future__ import annotations

import subprocess
import sys
import time
from typing import Any

from app.assistant.dev.repo_root import resolve_backend_dir
from app.assistant.dev.sandbox import SandboxError, ensure_repo_path

OUTPUT_LIMIT = 8192


def _truncate(text: str, limit: int = OUTPUT_LIMIT) -> str:
    if len(text) <= limit:
        return text
    return text[-limit:]


def run_pytest(
    path: str = "tests",
    keyword: str | None = None,
    markers: str | None = None,
    timeout_seconds: int = 120,
) -> dict[str, Any]:
    """Run pytest under decision-matrix/backend with sandboxed path."""
    backend = resolve_backend_dir()
    try:
        target = ensure_repo_path(path, backend_only=True)
    except SandboxError as e:
        return {"ok": False, "error": str(e), "code": "sandbox"}

    cmd = [sys.executable, "-m", "pytest", str(target)]
    if keyword:
        cmd.extend(["-k", keyword])
    if markers:
        cmd.extend(["-m", markers])

    started = time.perf_counter()
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(backend),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=max(5, min(timeout_seconds, 600)),
            shell=False,
        )
    except subprocess.TimeoutExpired as e:
        duration_ms = int((time.perf_counter() - started) * 1000)
        stdout = _truncate(e.stdout or "") if isinstance(e.stdout, str) else ""
        stderr = _truncate(e.stderr or "") if isinstance(e.stderr, str) else ""
        return {
            "ok": False,
            "exit_code": None,
            "stdout_tail": stdout,
            "stderr_tail": stderr or "pytest timed out",
            "duration_ms": duration_ms,
            "code": "timeout",
        }
    except OSError as e:
        return {"ok": False, "error": str(e), "code": "subprocess"}

    duration_ms = int((time.perf_counter() - started) * 1000)
    return {
        "ok": proc.returncode == 0,
        "exit_code": proc.returncode,
        "stdout_tail": _truncate(proc.stdout or ""),
        "stderr_tail": _truncate(proc.stderr or ""),
        "duration_ms": duration_ms,
        "command": cmd,
    }
