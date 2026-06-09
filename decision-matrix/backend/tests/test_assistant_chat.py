"""Assistant chat API tests — mock LLM, no real LM Studio."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.assistant.chat.llm_client import LlmResponse, LlmToolCall, parse_text_tool_calls
from app.assistant.chat.orchestrator import (
    _compact_tool_payload_for_llm,
    _enrich_tool_arguments,
    _user_wants_data,
)
from app.assistant.schemas import ToolResult
from app.assistant.chat.pending import create_pending_action_id
from app.assistant.chat.schemas import ChatMessage, ChatRequest
from tests.conftest import csrf_headers, login, seed_role_users
from tests.factories import create_test_poi, create_test_project


@pytest.fixture(scope="module", autouse=True)
def _seed():
    import asyncio

    asyncio.run(seed_role_users())


def test_chat_disabled(client, monkeypatch):
    monkeypatch.setattr("app.api.v1.assistant.settings.ASSISTANT_CHAT_ENABLED", False)
    login(client, "analyst@test.ru")
    res = client.post(
        "/api/v1/assistant/chat",
        headers={**csrf_headers(client), "Content-Type": "application/json"},
        json={"messages": [{"role": "user", "content": "hi"}]},
    )
    assert res.status_code == 404


def test_chat_requires_auth(client):
    res = client.post(
        "/api/v1/assistant/chat",
        headers={"Content-Type": "application/json"},
        json={"messages": [{"role": "user", "content": "hi"}]},
    )
    assert res.status_code in (401, 403)


def test_assistant_status(client):
    res = client.get("/api/v1/assistant/status")
    assert res.status_code == 200
    body = res.json()
    assert body["enabled"] is True
    assert "mcp_url" in body
    assert "mcp_setup_hint_ru" in body


@patch("app.assistant.chat.orchestrator.chat_completion", new_callable=AsyncMock)
def test_chat_mock_llm_list_projects(mock_llm, client):
    async def _side_effect(messages, tools=None):
        if any(m.get("role") == "tool" for m in messages):
            return LlmResponse(content="У вас есть проекты в системе.")
        return LlmResponse(
            tool_calls=[
                LlmToolCall(id="call_1", name="list_projects", arguments={}),
            ]
        )

    mock_llm.side_effect = _side_effect

    login(client, "analyst@test.ru")
    res = client.post(
        "/api/v1/assistant/chat",
        headers={**csrf_headers(client), "Content-Type": "application/json"},
        json={"messages": [{"role": "user", "content": "Сколько проектов?"}]},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["message"]["role"] == "assistant"
    assert body["tool_calls_made"]
    assert body["tool_calls_made"][0]["name"] == "list_projects"
    assert body["tool_calls_made"][0]["ok"] is True


@patch("app.assistant.chat.orchestrator.chat_completion", new_callable=AsyncMock)
def test_chat_create_poi_requires_confirm(mock_llm, client):
    project_id = str(uuid4())
    mock_llm.return_value = LlmResponse(
        tool_calls=[
            LlmToolCall(
                id="call_poi",
                name="create_poi",
                arguments={
                    "project_id": project_id,
                    "name": "Test POI",
                    "lon": 50.0,
                    "lat": 55.0,
                },
            ),
        ],
    )

    login(client, "analyst@test.ru")
    res = client.post(
        "/api/v1/assistant/chat",
        headers={**csrf_headers(client), "Content-Type": "application/json"},
        json={
            "messages": [{"role": "user", "content": "Создай POI"}],
            "project_id": project_id,
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["pending_action"] is not None
    assert body["pending_action"]["tool"] == "create_poi"
    assert body["tool_calls_made"] == []


@patch("app.assistant.chat.orchestrator.chat_completion", new_callable=AsyncMock)
def test_chat_mutating_requires_confirm(mock_llm, client):
    project_id = str(uuid4())
    mock_llm.return_value = LlmResponse(
        tool_calls=[
            LlmToolCall(
                id="call_mut",
                name="start_analyze_all_pois",
                arguments={"project_id": project_id},
            ),
        ],
    )

    login(client, "analyst@test.ru")
    res = client.post(
        "/api/v1/assistant/chat",
        headers={**csrf_headers(client), "Content-Type": "application/json"},
        json={
            "messages": [{"role": "user", "content": "Запусти анализ"}],
            "project_id": project_id,
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["pending_action"] is not None
    assert body["pending_action"]["tool"] == "start_analyze_all_pois"
    assert body["tool_calls_made"] == []


def test_chat_confirm_executes_mutating(client):
    import asyncio

    from sqlalchemy import select

    from app.core.database import async_session
    from app.models import Project, User

    async def _setup():
        async with async_session() as db:
            user = await db.scalar(select(User).where(User.email == "analyst@test.ru"))
            assert user
            project = Project(user_id=user.id, name="Chat Confirm Project", status="draft")
            db.add(project)
            await db.commit()
            await db.refresh(project)
            return user, project

    user, project = asyncio.run(_setup())
    action_id = create_pending_action_id(
        user.id,
        "list_projects",
        {},
    )

    login(client, "analyst@test.ru")
    res = client.post(
        "/api/v1/assistant/chat",
        headers={**csrf_headers(client), "Content-Type": "application/json"},
        json={
            "messages": [{"role": "user", "content": "подтверждаю"}],
            "project_id": str(project.id),
            "confirm_action_id": action_id,
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["pending_action"] is None
    assert body["tool_calls_made"][0]["name"] == "list_projects"
    assert body["tool_calls_made"][0]["ok"] is True
    assert "Chat Confirm Project" in body["message"]["content"] or "проект" in body["message"]["content"].lower()


@patch("app.assistant.chat.orchestrator.chat_completion", new_callable=AsyncMock)
def test_chat_cancel_job_requires_confirm(mock_llm, client):
    project_id = str(uuid4())
    job_id = str(uuid4())
    mock_llm.return_value = LlmResponse(
        tool_calls=[
            LlmToolCall(
                id="call_cancel",
                name="cancel_project_job",
                arguments={"project_id": project_id, "job_id": job_id},
            ),
        ],
    )

    login(client, "analyst@test.ru")
    res = client.post(
        "/api/v1/assistant/chat",
        headers={**csrf_headers(client), "Content-Type": "application/json"},
        json={
            "messages": [{"role": "user", "content": "Отмени задачу"}],
            "project_id": project_id,
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["pending_action"] is not None
    assert body["pending_action"]["tool"] == "cancel_project_job"
    assert body["tool_calls_made"] == []


def _parse_sse_events(text: str) -> list[tuple[str, dict]]:
    events: list[tuple[str, dict]] = []
    for block in text.split("\n\n"):
        if not block.strip():
            continue
        event = "message"
        data: dict | None = None
        for line in block.split("\n"):
            if line.startswith("event:"):
                event = line[6:].strip()
            elif line.startswith("data:"):
                data = json.loads(line[5:].strip())
        if data is not None:
            events.append((event, data))
    return events


def test_chat_stream_requires_auth(client):
    res = client.post(
        "/api/v1/assistant/chat/stream",
        headers={"Content-Type": "application/json"},
        json={"messages": [{"role": "user", "content": "hi"}]},
    )
    assert res.status_code in (401, 403)


@patch("app.assistant.chat.orchestrator.chat_completion_stream")
@patch("app.assistant.chat.orchestrator.chat_completion", new_callable=AsyncMock)
def test_chat_stream_mock_tokens(mock_llm, mock_stream, client):
    async def _stream(messages, tools=None):
        for part in ("Привет", ", мир"):
            yield part

    mock_stream.side_effect = _stream

    login(client, "analyst@test.ru")
    res = client.post(
        "/api/v1/assistant/chat/stream",
        headers={**csrf_headers(client), "Content-Type": "application/json"},
        json={"messages": [{"role": "user", "content": "Привет"}]},
    )
    assert res.status_code == 200, res.text
    events = _parse_sse_events(res.text)
    token_events = [d for ev, d in events if ev == "token"]
    done_events = [d for ev, d in events if ev == "done"]
    assert token_events
    assert "".join(t["delta"] for t in token_events) == "Привет, мир"
    assert done_events
    assert done_events[0]["message"]["content"] == "Привет, мир"
    mock_llm.assert_not_called()


@patch("app.assistant.chat.orchestrator.chat_completion_stream")
@patch("app.assistant.chat.orchestrator.chat_completion", new_callable=AsyncMock)
def test_chat_stream_tool_events(mock_llm, mock_stream, client):
    async def _completion(messages, tools=None):
        if tools and not any(m.get("role") == "tool" for m in messages):
            return LlmResponse(
                tool_calls=[
                    LlmToolCall(id="call_1", name="list_projects", arguments={}),
                ]
            )
        return LlmResponse(content="")

    async def _stream(messages, tools=None):
        yield "У вас "
        yield "есть проекты."

    mock_llm.side_effect = _completion
    mock_stream.side_effect = _stream

    login(client, "analyst@test.ru")
    res = client.post(
        "/api/v1/assistant/chat/stream",
        headers={**csrf_headers(client), "Content-Type": "application/json"},
        json={"messages": [{"role": "user", "content": "Сколько проектов?"}]},
    )
    assert res.status_code == 200, res.text
    events = _parse_sse_events(res.text)
    kinds = [ev for ev, _ in events]
    assert "tool_start" in kinds
    assert "tool_done" in kinds
    assert "token" in kinds
    assert "done" in kinds
    tool_start = next(d for ev, d in events if ev == "tool_start")
    assert tool_start["name"] == "list_projects"
    tool_done = next(d for ev, d in events if ev == "tool_done")
    assert tool_done["ok"] is True
    token_text = "".join(d["delta"] for ev, d in events if ev == "token")
    assert "Доступных проектов" in token_text
    mock_stream.assert_not_called()


@patch("app.assistant.chat.orchestrator.chat_completion", new_callable=AsyncMock)
def test_chat_stream_mutating_pending(mock_llm, client):
    project_id = str(uuid4())
    mock_llm.return_value = LlmResponse(
        tool_calls=[
            LlmToolCall(
                id="call_mut",
                name="start_analyze_all_pois",
                arguments={"project_id": project_id},
            ),
        ],
    )

    login(client, "analyst@test.ru")
    res = client.post(
        "/api/v1/assistant/chat/stream",
        headers={**csrf_headers(client), "Content-Type": "application/json"},
        json={
            "messages": [{"role": "user", "content": "Запусти анализ"}],
            "project_id": project_id,
        },
    )
    assert res.status_code == 200, res.text
    events = _parse_sse_events(res.text)
    kinds = [ev for ev, _ in events]
    assert "pending_action" in kinds
    assert "done" in kinds
    done = next(d for ev, d in events if ev == "done")
    assert done["pending_action"] is not None
    assert done["pending_action"]["tool"] == "start_analyze_all_pois"
    assert done["tool_calls_made"] == []


def test_compact_infra_objects_includes_subtype_breakdown():
    items = (
        [{"subtype": "node", "category": "network"}] * 3
        + [{"subtype": "autoroad", "category": "road"}] * 2
    )
    payload = _compact_tool_payload_for_llm(
        "list_infra_objects",
        ToolResult(ok=True, data=items),
    )
    data = payload["data"]
    assert data["count"] == 5
    assert data["count_by_subtype"] == {"node": 3, "autoroad": 2}
    assert data["count_by_category"] == {"network": 3, "road": 2}


def test_enrich_tool_arguments_injects_project_id():
    project_id = uuid4()
    request = ChatRequest(
        messages=[ChatMessage(role="user", content="Сколько объектов?")],
        project_id=project_id,
    )
    enriched = _enrich_tool_arguments("list_infra_objects", {}, request)
    assert enriched["project_id"] == str(project_id)


def test_user_wants_data_uses_last_turn_only():
    msgs = [
        ChatMessage(role="user", content="Сколько проектов?"),
        ChatMessage(role="assistant", content="У вас 3 проекта."),
        ChatMessage(role="user", content="Спасибо"),
    ]
    assert _user_wants_data(msgs) is False
    assert _user_wants_data([ChatMessage(role="user", content="Покажи POI")]) is True


@patch("app.assistant.chat.orchestrator.chat_completion_stream")
@patch("app.assistant.chat.orchestrator.chat_completion", new_callable=AsyncMock)
def test_chat_stream_multi_turn(mock_llm, mock_stream, client):
    async def _completion(messages, tools=None):
        if tools and not any(m.get("role") == "tool" for m in messages):
            return LlmResponse(
                tool_calls=[LlmToolCall(id="call_1", name="list_projects", arguments={})],
            )
        return LlmResponse(content="")

    async def _stream(messages, tools=None):
        user_turns = [m["content"] for m in messages if m.get("role") == "user"]
        if len(user_turns) >= 2:
            yield "Второй ответ."
        else:
            yield "Первый ответ."

    mock_llm.side_effect = _completion
    mock_stream.side_effect = _stream

    login(client, "analyst@test.ru")
    headers = {**csrf_headers(client), "Content-Type": "application/json"}

    res1 = client.post(
        "/api/v1/assistant/chat/stream",
        headers=headers,
        json={"messages": [{"role": "user", "content": "Сколько проектов?"}]},
    )
    assert res1.status_code == 200, res1.text
    events1 = _parse_sse_events(res1.text)
    done1 = next(d for ev, d in events1 if ev == "done")

    res2 = client.post(
        "/api/v1/assistant/chat/stream",
        headers=headers,
        json={
            "messages": [
                {"role": "user", "content": "Сколько проектов?"},
                {"role": "assistant", "content": done1["message"]["content"]},
                {"role": "user", "content": "Спасибо, а что ещё?"},
            ]
        },
    )
    assert res2.status_code == 200, res2.text
    events2 = _parse_sse_events(res2.text)
    assert "error" not in [ev for ev, _ in events2]
    done2 = next(d for ev, d in events2 if ev == "done")
    assert done2["message"]["content"] == "Второй ответ."
    assert mock_llm.call_count == 1


def test_humanize_tool_names_in_text():
    from app.assistant.chat.tool_labels import humanize_tool_names_in_text

    text = (
        "Для проверки вызову `get_autoroad_solver_status`, затем list_infra_objects."
    )
    out = humanize_tool_names_in_text(text)
    assert "get_autoroad_solver_status" not in out
    assert "list_infra_objects" not in out
    assert "Статус расчёта автодорог" in out
    assert "Объекты инфраструктуры" in out


def test_parse_text_tool_calls_qwen_style():
    content = '<tool_call>{"name": "admin_list_jobs", "arguments": {}}</tool_call>'
    calls = parse_text_tool_calls(content)
    assert len(calls) == 1
    assert calls[0].name == "admin_list_jobs"
    assert calls[0].arguments == {}


@patch("app.assistant.chat.orchestrator.chat_completion", new_callable=AsyncMock)
def test_chat_map_objects_uses_server_formatter(mock_llm, client):
    """After list_infra_objects, answer must come from DB aggregation — not LLM invention."""
    project, _headers = create_test_project(client, email="analyst@test.ru", name="formatter_test")
    project_id = project["id"]

    async def _side_effect(messages, tools=None):
        if tools and not any(m.get("role") == "tool" for m in messages):
            return LlmResponse(
                tool_calls=[
                    LlmToolCall(id="call_map", name="list_infra_objects", arguments={}),
                ],
            )
        # LLM would hallucinate — must not be used for final answer
        return LlmResponse(
            content="На карте 12 объектов: 5 скважин, 3 магистрали (выдумка).",
        )

    mock_llm.side_effect = _side_effect

    login(client, "analyst@test.ru")
    res = client.post(
        "/api/v1/assistant/chat",
        headers={**csrf_headers(client), "Content-Type": "application/json"},
        json={
            "messages": [{"role": "user", "content": "какие объекты есть на карте?"}],
            "project_id": project_id,
            "active_tab": "map",
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["tool_calls_made"][0]["name"] == "list_infra_objects"
    assert "скважин" not in body["message"]["content"].lower()
    assert "магистрал" not in body["message"]["content"].lower()
    assert "видимых слоях" in body["message"]["content"]
    mock_llm.assert_called_once()


@patch("app.assistant.chat.orchestrator.chat_completion", new_callable=AsyncMock)
def test_chat_map_objects_count_uses_ui_project(mock_llm, client):
    project, _headers = create_test_project(client, email="analyst@test.ru", name="test_map_count")
    project_id = project["id"]

    async def _side_effect(messages, tools=None):
        if tools and not any(m.get("role") == "tool" for m in messages):
            return LlmResponse(
                tool_calls=[LlmToolCall(id="call_map", name="list_infra_objects", arguments={})],
            )
        return LlmResponse(content="На карте 2 объекта инфраструктуры.")

    mock_llm.side_effect = _side_effect

    login(client, "analyst@test.ru")
    res = client.post(
        "/api/v1/assistant/chat",
        headers={**csrf_headers(client), "Content-Type": "application/json"},
        json={
            "messages": [{"role": "user", "content": "Сколько объектов на карте?"}],
            "project_id": project_id,
            "active_tab": "map",
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["tool_calls_made"][0]["name"] == "list_infra_objects"
    assert body["tool_calls_made"][0]["ok"] is True


@patch("app.assistant.chat.orchestrator.chat_completion", new_callable=AsyncMock)
def test_chat_text_tool_call_after_tool_round(mock_llm, client):
    """Local LLMs often emit <tool_call> in synthesis after first tool — must execute, not leak."""
    project_id = str(uuid4())
    layer_call_done = False

    async def _side_effect(messages, tools=None):
        nonlocal layer_call_done
        if tools and not any(m.get("role") == "tool" for m in messages):
            return LlmResponse(
                tool_calls=[
                    LlmToolCall(id="call_layers", name="list_infra_layers", arguments={}),
                ],
            )
        if any(m.get("role") == "tool" for m in messages) and not layer_call_done:
            layer_call_done = True
            return LlmResponse(
                content=(
                    'Сейчас запрошу объекты.\n'
                    '<tool_call>{"name": "list_infra_objects", "arguments": {}}</tool_call>'
                ),
            )
        return LlmResponse(content="На карте 3 объекта инфраструктуры.")

    mock_llm.side_effect = _side_effect

    login(client, "analyst@test.ru")
    res = client.post(
        "/api/v1/assistant/chat",
        headers={**csrf_headers(client), "Content-Type": "application/json"},
        json={
            "messages": [{"role": "user", "content": "Покажи объекты инфраструктуры на карте"}],
            "project_id": project_id,
            "active_tab": "map",
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    names = [t["name"] for t in body["tool_calls_made"]]
    assert "list_infra_layers" in names
    assert "list_infra_objects" in names
    assert "<tool_call>" not in body["message"]["content"]
    assert "3 объекта" in body["message"]["content"]


@patch("app.assistant.chat.orchestrator.chat_completion", new_callable=AsyncMock)
def test_chat_text_tool_call_fallback(mock_llm, client):
    async def _side_effect(messages, tools=None):
        if tools and not any(m.get("role") == "tool" for m in messages):
            return LlmResponse(
                content='<tool_call>{"name": "list_projects", "arguments": {}}</tool_call>',
            )
        return LlmResponse(content="Вот список ваших проектов.")

    mock_llm.side_effect = _side_effect

    login(client, "analyst@test.ru")
    res = client.post(
        "/api/v1/assistant/chat",
        headers={**csrf_headers(client), "Content-Type": "application/json"},
        json={"messages": [{"role": "user", "content": "Сколько проектов?"}]},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["tool_calls_made"][0]["name"] == "list_projects"
    assert "<tool_call>" not in body["message"]["content"]


@patch("app.assistant.chat.orchestrator.chat_completion", new_callable=AsyncMock)
def test_chat_ui_context_in_system_prompt(mock_llm, client):
    project_id = str(uuid4())
    poi_id = str(uuid4())
    captured_messages: list[list[dict]] = []

    async def _capture(messages, tools=None):
        captured_messages.append(messages)
        return LlmResponse(content="Контекст принят.")

    mock_llm.side_effect = _capture

    login(client, "analyst@test.ru")
    res = client.post(
        "/api/v1/assistant/chat",
        headers={**csrf_headers(client), "Content-Type": "application/json"},
        json={
            "messages": [{"role": "user", "content": "Привет"}],
            "project_id": project_id,
            "project_name": "Тестовый проект",
            "selected_poi_id": poi_id,
            "active_tab": "map",
            "route_path": "/map",
        },
    )
    assert res.status_code == 200, res.text
    assert captured_messages
    system = captured_messages[0][0]["content"]
    assert "Тестовый проект" in system
    assert project_id in system
    assert poi_id in system
    assert "map" in system


@patch("app.assistant.chat.orchestrator.chat_completion", new_callable=AsyncMock)
def test_chat_pois_uses_server_formatter(mock_llm, client):
    project, _headers = create_test_project(client, email="analyst@test.ru", name="poi_fmt_test")
    project_id = project["id"]
    create_test_poi(client, project_id, name="Скважина-1")

    async def _side_effect(messages, tools=None):
        if tools and not any(m.get("role") == "tool" for m in messages):
            return LlmResponse(
                tool_calls=[LlmToolCall(id="call_poi", name="list_pois", arguments={})],
            )
        return LlmResponse(content="В проекте 99 POI (выдумка).")

    mock_llm.side_effect = _side_effect

    login(client, "analyst@test.ru")
    res = client.post(
        "/api/v1/assistant/chat",
        headers={**csrf_headers(client), "Content-Type": "application/json"},
        json={
            "messages": [{"role": "user", "content": "Сколько POI в проекте?"}],
            "project_id": project_id,
            "project_name": "poi_fmt_test",
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["tool_calls_made"][0]["name"] == "list_pois"
    assert "99" not in body["message"]["content"]
    assert "Скважина-1" in body["message"]["content"]
    mock_llm.assert_called_once()


@patch("app.assistant.chat.orchestrator.chat_completion", new_callable=AsyncMock)
def test_chat_job_status_uses_server_formatter(mock_llm, client):
    project, _headers = create_test_project(client, email="analyst@test.ru", name="job_fmt_test")
    project_id = project["id"]

    async def _side_effect(messages, tools=None):
        if tools and not any(m.get("role") == "tool" for m in messages):
            return LlmResponse(
                tool_calls=[LlmToolCall(id="call_job", name="get_project_job", arguments={})],
            )
        return LlmResponse(content="Задача выполняется на 80% (выдумка).")

    mock_llm.side_effect = _side_effect

    login(client, "analyst@test.ru")
    res = client.post(
        "/api/v1/assistant/chat",
        headers={**csrf_headers(client), "Content-Type": "application/json"},
        json={
            "messages": [{"role": "user", "content": "Какой статус фоновой задачи?"}],
            "project_id": project_id,
            "project_name": "job_fmt_test",
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["tool_calls_made"][0]["name"] == "get_project_job"
    assert "80%" not in body["message"]["content"]
    assert "активных" in body["message"]["content"].lower()
    mock_llm.assert_called_once()


@patch("app.assistant.chat.orchestrator.chat_completion", new_callable=AsyncMock)
def test_chat_rates_uses_server_formatter(mock_llm, client):
    project, _headers = create_test_project(client, email="analyst@test.ru", name="rates_fmt_test")
    project_id = project["id"]

    async def _side_effect(messages, tools=None):
        if tools and not any(m.get("role") == "tool" for m in messages):
            return LlmResponse(
                tool_calls=[LlmToolCall(id="call_rates", name="get_cost_rates", arguments={})],
            )
        return LlmResponse(content="Тариф автодороги — 999999 тыс. (выдумка).")

    mock_llm.side_effect = _side_effect

    login(client, "analyst@test.ru")
    res = client.post(
        "/api/v1/assistant/chat",
        headers={**csrf_headers(client), "Content-Type": "application/json"},
        json={
            "messages": [{"role": "user", "content": "Покажи тарифы проекта"}],
            "project_id": project_id,
            "project_name": "rates_fmt_test",
            "active_tab": "parameters/rates",
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["tool_calls_made"][0]["name"] == "get_cost_rates"
    assert "999999" not in body["message"]["content"]
    assert "Данные из системы" in body["message"]["content"]
    mock_llm.assert_called_once()
