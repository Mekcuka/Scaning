"""Stdio MCP entrypoint for Cursor dev tools (phase 4)."""

from __future__ import annotations

import json
import sys

from mcp.server.fastmcp import FastMCP

from app.assistant.dev.tools.git_tool import git_log, git_status
from app.assistant.dev.tools.pytest_tool import run_pytest
from app.assistant.dev.tools.search import search_codebase
from app.core.config import settings

mcp = FastMCP("Atlas Grid Dev")


def _json_result(payload: dict) -> str:
    return json.dumps(payload, ensure_ascii=False)


@mcp.tool()
def run_pytest_tool(
    path: str = "tests",
    keyword: str | None = None,
    markers: str | None = None,
    timeout_seconds: int = 120,
) -> str:
    """Run pytest in decision-matrix/backend (sandboxed path)."""
    return _json_result(
        run_pytest(
            path=path,
            keyword=keyword,
            markers=markers,
            timeout_seconds=timeout_seconds,
        )
    )


@mcp.tool()
def search_codebase_tool(
    query: str,
    glob: str = "*.{py,ts,tsx,md}",
    max_results: int = 20,
) -> str:
    """Search repository source files (ripgrep or Python fallback)."""
    return _json_result(search_codebase(query=query, glob=glob, max_results=max_results))


@mcp.tool()
def git_status_tool(path: str | None = None) -> str:
    """Git short status and current branch for the monorepo."""
    return _json_result(git_status(path=path))


@mcp.tool()
def git_log_tool(max_count: int = 10, path: str | None = None) -> str:
    """Recent git commits (oneline)."""
    return _json_result(git_log(max_count=max_count, path=path))


def _guard_startup() -> None:
    if not settings.ASSISTANT_DEV_MCP_ENABLED:
        print("ASSISTANT_DEV_MCP_ENABLED=false — dev MCP is disabled", file=sys.stderr)
        raise SystemExit(1)
    if settings.ENVIRONMENT == "production":
        print("Dev MCP is not available in production", file=sys.stderr)
        raise SystemExit(1)


def _maybe_register_domain_tools() -> None:
    if not settings.ASSISTANT_DEV_MCP_DOMAIN_TOOLS:
        return
    from app.assistant.dev.domain_proxy import register_readonly_domain_tools

    count = register_readonly_domain_tools(mcp)
    print(f"Dev MCP: registered {count} read-only domain tools", file=sys.stderr)


def main() -> None:
    _guard_startup()
    _maybe_register_domain_tools()
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
