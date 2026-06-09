"""Dev stdio MCP tool handler tests."""

from __future__ import annotations

import subprocess
from pathlib import Path
import pytest

from app.assistant.dev.repo_root import resolve_backend_dir, resolve_repo_root
from app.assistant.dev.sandbox import SandboxError, ensure_repo_path
from app.assistant.dev.stdio_mcp import _guard_startup
from app.assistant.dev.tools.git_tool import git_log, git_status
from app.assistant.dev.tools.pytest_tool import run_pytest
from app.assistant.dev.tools.search import search_codebase
from app.core.config import settings

BACKEND_DIR = Path(__file__).resolve().parents[1]


def test_repo_root_detect():
    backend = resolve_backend_dir(BACKEND_DIR)
    assert backend.name == "backend"
    assert (backend / "pytest.ini").exists()
    repo = resolve_repo_root(BACKEND_DIR)
    assert (repo / "decision-matrix").is_dir() or (repo / ".git").exists()


def test_sandbox_rejects_escape():
    with pytest.raises(SandboxError):
        ensure_repo_path("../../../etc/passwd", backend_only=True)


def test_sandbox_rejects_env_file():
    with pytest.raises(SandboxError):
        ensure_repo_path(".env", backend_only=True)


def test_run_pytest_smoke(monkeypatch):
    class FakeProc:
        returncode = 0
        stdout = "1 passed"
        stderr = ""

    def fake_run(*_args, **_kwargs):
        return FakeProc()

    monkeypatch.setattr("app.assistant.dev.tools.pytest_tool.subprocess.run", fake_run)
    result = run_pytest(path="tests")
    assert result["ok"] is True
    assert result["exit_code"] == 0
    assert "passed" in result["stdout_tail"]


def test_run_pytest_timeout(monkeypatch):
    def fake_run(*_args, **_kwargs):
        raise subprocess.TimeoutExpired(cmd=["pytest"], timeout=1)

    monkeypatch.setattr("app.assistant.dev.tools.pytest_tool.subprocess.run", fake_run)
    result = run_pytest(path="tests", timeout_seconds=1)
    assert result["ok"] is False
    assert result["code"] == "timeout"


def test_search_codebase_python_fallback(monkeypatch):
    monkeypatch.setattr("app.assistant.dev.tools.search._search_with_rg", lambda *_a, **_k: None)
    result = search_codebase(query="ToolContext", max_results=5)
    assert result["ok"] is True
    assert result["engine"] == "python"
    assert result["count"] >= 1


def test_search_codebase_requires_query():
    result = search_codebase(query="   ")
    assert result["ok"] is False
    assert result["code"] == "validation"


def test_git_status(monkeypatch):
    def fake_run_git(args, *, cwd, timeout=30):
        if args[:2] == ["branch", "--show-current"]:
            return {"ok": True, "stdout": "main\n", "stderr": ""}
        if args[:2] == ["status", "--short"]:
            return {"ok": True, "stdout": " M README.md\n", "stderr": ""}
        return {"ok": False, "error": "unexpected", "code": "git_error"}

    monkeypatch.setattr("app.assistant.dev.tools.git_tool._run_git", fake_run_git)
    result = git_status()
    assert result["ok"] is True
    assert result["branch"] == "main"
    assert result["changed_count"] == 1


def test_git_log(monkeypatch):
    def fake_run_git(args, *, cwd, timeout=30):
        return {
            "ok": True,
            "stdout": "abc1234 feat: test\n",
            "stderr": "",
        }

    monkeypatch.setattr("app.assistant.dev.tools.git_tool._run_git", fake_run_git)
    result = git_log(max_count=5)
    assert result["ok"] is True
    assert result["count"] == 1
    assert "abc1234" in result["commits"][0]


def test_dev_mcp_disabled(monkeypatch):
    monkeypatch.setattr(settings, "ASSISTANT_DEV_MCP_ENABLED", False)
    with pytest.raises(SystemExit) as exc:
        _guard_startup()
    assert exc.value.code == 1


def test_dev_mcp_production_blocked(monkeypatch):
    monkeypatch.setattr(settings, "ASSISTANT_DEV_MCP_ENABLED", True)
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    with pytest.raises(SystemExit) as exc:
        _guard_startup()
    assert exc.value.code == 1
