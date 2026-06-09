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
    names = {t["name"] for t in tools}
    assert "list_projects" in names
    assert "get_me" in names
    assert "admin_list_jobs" not in names
    assert len(names) >= 28


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


def test_mcp_list_resources(client, mcp_client):
    login_response = login(client, "analyst@test.ru")
    token = login_response.json()["access_token"]
    headers = _mcp_headers(token)

    _mcp_initialize(mcp_client, headers)

    response = mcp_client.post(
        MCP_PATH,
        headers=headers,
        json={"jsonrpc": "2.0", "method": "resources/list", "params": {}, "id": 10},
    )
    assert response.status_code == 200, response.text
    resources = response.json()["result"]["resources"]
    uris = {r["uri"] for r in resources}
    assert "docs://calculation-logic" in uris
    assert "docs://infrastructure-subtypes" in uris
    assert "openapi://v1" in uris


def test_mcp_read_resource_calculation_logic(client, mcp_client):
    login_response = login(client, "analyst@test.ru")
    token = login_response.json()["access_token"]
    headers = _mcp_headers(token)

    _mcp_initialize(mcp_client, headers)

    response = mcp_client.post(
        MCP_PATH,
        headers=headers,
        json={
            "jsonrpc": "2.0",
            "method": "resources/read",
            "params": {"uri": "docs://calculation-logic"},
            "id": 11,
        },
    )
    assert response.status_code == 200, response.text
    contents = response.json()["result"]["contents"]
    assert len(contents) == 1
    assert len(contents[0]["text"]) > 100
    assert contents[0]["mimeType"] == "text/markdown"


def test_mcp_call_mutating_tool_blocked(client, mcp_client):
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
            "params": {
                "name": "cancel_project_job",
                "arguments": {
                    "project_id": "00000000-0000-0000-0000-000000000001",
                    "job_id": "00000000-0000-0000-0000-000000000002",
                },
            },
            "id": 20,
        },
    )
    assert response.status_code == 200, response.text
    payload = json.loads(response.json()["result"]["content"][0]["text"])
    assert payload["ok"] is False
    assert payload["code"] == "confirm_required"


def test_mcp_read_resource_openapi(client, mcp_client):
    login_response = login(client, "analyst@test.ru")
    token = login_response.json()["access_token"]
    headers = _mcp_headers(token)

    _mcp_initialize(mcp_client, headers)

    response = mcp_client.post(
        MCP_PATH,
        headers=headers,
        json={
            "jsonrpc": "2.0",
            "method": "resources/read",
            "params": {"uri": "openapi://v1"},
            "id": 12,
        },
    )
    assert response.status_code == 200, response.text
    contents = response.json()["result"]["contents"]
    assert len(contents) == 1
    schema = json.loads(contents[0]["text"])
    assert "paths" in schema
    assert contents[0]["mimeType"] == "application/json"
