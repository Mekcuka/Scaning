"""Admin assistant LLM config API tests."""

from __future__ import annotations

import asyncio
import json

import pytest

from app.assistant.llm_override import clear_llm_override
from tests.conftest import csrf_headers, login, seed_role_users


@pytest.fixture(autouse=True)
def _clear_override():
    clear_llm_override()
    yield
    clear_llm_override()


@pytest.fixture(scope="module", autouse=True)
def _seed():
    asyncio.run(seed_role_users())


def test_get_llm_config_admin_ok(client):
    login(client, "admin@test.ru")
    res = client.get(
        "/api/v1/admin/assistant/llm-config",
        headers=csrf_headers(client),
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert "provider_ready" in data
    assert data["chat_enabled"] is True
    assert "effective" in data
    assert "env" in data
    assert "runtime_override" in data
    assert "wiki_rag" in data
    raw = json.dumps(data)
    assert "ASSISTANT_LLM_API_KEY" not in raw
    assert "lm-studio" not in raw or "***" in raw


def test_get_llm_config_forbidden_for_analyst(client):
    login(client, "analyst@test.ru")
    res = client.get(
        "/api/v1/admin/assistant/llm-config",
        headers=csrf_headers(client),
    )
    assert res.status_code == 403


def test_post_llm_config_override_masks_api_key(client):
    login(client, "admin@test.ru")
    headers = {**csrf_headers(client), "Content-Type": "application/json"}
    res = client.post(
        "/api/v1/admin/assistant/llm-config",
        headers=headers,
        json={
            "base_url": "http://127.0.0.1:1234/v1",
            "model": "test-model",
            "api_key": "secret-key-1234",
        },
    )
    assert res.status_code == 200, res.text
    applied = res.json()["applied"]
    assert applied["api_key"] == "***…1234"
    assert "secret-key" not in json.dumps(applied)

    get_res = client.get("/api/v1/admin/assistant/llm-config", headers=csrf_headers(client))
    assert get_res.status_code == 200
    detail = get_res.json()
    assert detail["effective"]["base_url"] == "http://127.0.0.1:1234/v1"
    assert detail["effective"]["model"] == "test-model"
    assert detail["effective"]["api_key_source"] == "override"
    assert "secret-key" not in json.dumps(detail)


def test_delete_llm_config_clears_override(client):
    login(client, "admin@test.ru")
    headers = {**csrf_headers(client), "Content-Type": "application/json"}
    client.post(
        "/api/v1/admin/assistant/llm-config",
        headers=headers,
        json={"model": "temp-model"},
    )
    del_res = client.delete(
        "/api/v1/admin/assistant/llm-config",
        headers=csrf_headers(client),
    )
    assert del_res.status_code == 200
    get_res = client.get("/api/v1/admin/assistant/llm-config", headers=csrf_headers(client))
    assert get_res.json()["runtime_override"] == {}
