"""Admin assistant LLM probe and extended config API tests."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

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


def test_post_llm_probe_admin_ok(client):
    login(client, "admin@test.ru")
    probe_payload = {
        "chat": {"ok": True, "models": {"ok": True, "http_status": 200, "hint_ru": "OK"}, "completion": {"ok": True, "http_status": 200, "hint_ru": "OK"}},
        "embeddings": {"ok": False, "http_status": 404, "hint_ru": "Embeddings: endpoint не найден"},
        "rag_mode": "tfidf",
        "provider_ready": True,
    }
    with patch(
        "app.api.v1.admin_assistant.run_full_llm_probe",
        new_callable=AsyncMock,
        return_value=probe_payload,
    ):
        res = client.post(
            "/api/v1/admin/assistant/llm-probe",
            headers=csrf_headers(client),
        )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["provider_ready"] is True
    assert data["rag_mode"] == "tfidf"
    assert data["embeddings"]["http_status"] == 404


def test_post_llm_probe_forbidden_for_analyst(client):
    login(client, "analyst@test.ru")
    res = client.post(
        "/api/v1/admin/assistant/llm-probe",
        headers=csrf_headers(client),
    )
    assert res.status_code == 403


def test_get_llm_config_includes_rag_mode_and_embedding(client):
    login(client, "admin@test.ru")
    res = client.get(
        "/api/v1/admin/assistant/llm-config",
        headers=csrf_headers(client),
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert "embedding_effective" in data
    assert "wiki_rag" in data
    assert "rag_mode" in data["wiki_rag"]
    assert "embedding_model" in data["wiki_rag"]
    assert "max_tokens" in data["effective"]
    assert "timeout_seconds" in data["effective"]


def test_post_llm_test_admin(client):
    login(client, "admin@test.ru")
    with patch(
        "app.api.v1.admin_assistant.run_llm_test_message",
        new_callable=AsyncMock,
        return_value={
            "ok": True,
            "latency_ms": 42,
            "model": "test-model",
            "reply": "OK",
            "error": None,
        },
    ):
        res = client.post(
            "/api/v1/admin/assistant/llm-test",
            headers=csrf_headers(client),
        )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["ok"] is True
    assert data["latency_ms"] == 42
    assert data["reply"] == "OK"


def test_get_llm_models_admin(client):
    login(client, "admin@test.ru")
    with patch(
        "app.api.v1.admin_assistant.list_chat_models",
        new_callable=AsyncMock,
        return_value=["model-a", "model-b"],
    ):
        res = client.get(
            "/api/v1/admin/assistant/llm-models",
            headers=csrf_headers(client),
        )
    assert res.status_code == 200, res.text
    assert res.json()["models"] == ["model-a", "model-b"]


def test_post_llm_config_embedding_override(client):
    login(client, "admin@test.ru")
    headers = {**csrf_headers(client), "Content-Type": "application/json"}
    res = client.post(
        "/api/v1/admin/assistant/llm-config",
        headers=headers,
        json={
            "embedding_base_url": "http://127.0.0.1:11434/v1",
            "embedding_model": "nomic-embed-text",
        },
    )
    assert res.status_code == 200, res.text
    get_res = client.get("/api/v1/admin/assistant/llm-config", headers=csrf_headers(client))
    detail = get_res.json()
    assert detail["embedding_effective"]["base_url"] == "http://127.0.0.1:11434/v1"
    assert detail["embedding_effective"]["model"] == "nomic-embed-text"
    assert detail["embedding_effective"]["uses_chat_config"] is False
