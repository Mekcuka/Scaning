"""HTTP MCP integration tests — auth middleware and Streamable HTTP wire protocol."""

from __future__ import annotations

import json
from contextlib import AsyncExitStack, asynccontextmanager

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient

from app.assistant.transport.http_mcp import create_mcp_asgi_app, mcp_lifespan, reset_mcp_singleton
from app.core.config import settings
from tests.conftest import login

MCP_PATH = "/api/v1/mcp/"


@pytest.fixture(scope="module")
def mcp_client():
    """Isolated MCP sub-app — avoids singleton session manager conflicts in full pytest run."""
    reset_mcp_singleton()

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        async with AsyncExitStack() as stack:
            await stack.enter_async_context(mcp_lifespan())
            yield

    test_app = FastAPI(lifespan=lifespan)
    test_app.mount(settings.ASSISTANT_MCP_PATH, create_mcp_asgi_app())
    with TestClient(test_app) as client:
        yield client


def _mcp_headers(access_token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _mcp_initialize(client, headers: dict[str, str]) -> None:
    init = client.post(
        MCP_PATH,
        headers=headers,
        json={
            "jsonrpc": "2.0",
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "pytest", "version": "1.0"},
            },
            "id": 1,
        },
    )
    assert init.status_code == 200, init.text
    client.post(
        MCP_PATH,
        headers=headers,
        json={"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}},
    )


def test_mcp_requires_auth(mcp_client):
    response = mcp_client.post(
        MCP_PATH,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        json={
            "jsonrpc": "2.0",
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "pytest", "version": "1.0"},
            },
            "id": 1,
        },
    )
    assert response.status_code == 401


def test_mcp_list_tools_authenticated(client, mcp_client):
    login_response = login(client, "analyst@test.ru")
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]
    headers = _mcp_headers(token)

    _mcp_initialize(mcp_client, headers)

    response = mcp_client.post(
        MCP_PATH,
        headers=headers,
        json={"jsonrpc": "2.0", "method": "tools/list", "params": {}, "id": 2},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    tools = body["result"]["tools"]
    assert len(tools) == 10
    assert {t["name"] for t in tools} == {
        "get_flow_schematic",
        "get_poi_analysis",
        "get_project",
        "get_project_job",
        "get_sand_logistics_result",
        "list_infra_objects",
        "list_pois",
        "list_project_jobs",
        "list_projects",
        "start_analyze_all_pois",
    }


def test_mcp_call_tool_list_projects(client, mcp_client):
    login_response = login(client, "analyst@test.ru")
    token = login_response.json()["access_token"]
    headers = _mcp_headers(token)

    _mcp_initialize(mcp_client, headers)

    response = mcp_client.post(
        MCP_PATH,
        headers=headers,
        json={
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {"name": "list_projects", "arguments": {}},
            "id": 3,
        },
    )
    assert response.status_code == 200, response.text
    content = response.json()["result"]["content"]
    assert len(content) == 1
    payload = json.loads(content[0]["text"])
    assert payload["ok"] is True
    assert isinstance(payload["data"], list)
