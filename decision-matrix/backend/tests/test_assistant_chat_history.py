"""Assistant chat session persistence (phase 8.2)."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

from sqlalchemy import select

from app.assistant.chat.history import create_session, list_session_messages, list_sessions, persist_turn
from app.assistant.chat.llm_client import LlmResponse
from app.assistant.chat.schemas import ChatMessage, ChatRequest, ChatResponse
from app.core.database import async_session
from app.models import User
from tests.conftest import csrf_headers, login, seed_role_users


def _seed():
    asyncio.run(seed_role_users())


def test_create_and_list_sessions():
    _seed()

    async def _run():
        async with async_session() as db:
            user = await db.scalar(select(User).where(User.email == "analyst@test.ru"))
            assert user is not None
            session = await create_session(db, user_id=user.id, title="Тест")
            await db.commit()
            rows = await list_sessions(db, user.id)
            assert any(r["id"] == session.id for r in rows)

    asyncio.run(_run())


def test_persist_turn_appends_messages():
    _seed()

    async def _run():
        async with async_session() as db:
            user = await db.scalar(select(User).where(User.email == "analyst@test.ru"))
            assert user is not None
            session = await create_session(db, user_id=user.id)
            await db.flush()
            request = ChatRequest(
                messages=[ChatMessage(role="user", content="Сколько проектов?")],
                session_id=session.id,
            )
            response = ChatResponse(
                message=ChatMessage(role="assistant", content="У вас 2 проекта."),
                tool_calls_made=[],
            )
            sid = await persist_turn(db, user.id, request, response, session_id=session.id)
            assert sid == session.id
            msgs = await list_session_messages(db, session.id, user.id)
            assert len(msgs) == 2
            assert msgs[0]["role"] == "user"
            assert msgs[1]["role"] == "assistant"

    asyncio.run(_run())


@patch("app.assistant.chat.orchestrator.chat_completion", new_callable=AsyncMock)
def test_chat_returns_session_id(mock_llm, client):
    _seed()
    mock_llm.return_value = LlmResponse(content="Привет")

    login(client, "analyst@test.ru")
    res = client.post(
        "/api/v1/assistant/chat",
        headers={**csrf_headers(client), "Content-Type": "application/json"},
        json={"messages": [{"role": "user", "content": "привет"}]},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body.get("session_id")


def test_list_sessions_api(client):
    _seed()
    login(client, "analyst@test.ru")
    create = client.post(
        "/api/v1/assistant/sessions",
        headers={**csrf_headers(client), "Content-Type": "application/json"},
        json={"title": "API session"},
    )
    assert create.status_code == 201, create.text
    session_id = create.json()["id"]

    listed = client.get("/api/v1/assistant/sessions", headers=csrf_headers(client))
    assert listed.status_code == 200
    assert any(s["id"] == session_id for s in listed.json())

    msgs = client.get(
        f"/api/v1/assistant/sessions/{session_id}/messages",
        headers=csrf_headers(client),
    )
    assert msgs.status_code == 200
    assert msgs.json()["session_id"] == session_id


def test_delete_session_api(client):
    _seed()
    login(client, "analyst@test.ru")
    create = client.post(
        "/api/v1/assistant/sessions",
        headers={**csrf_headers(client), "Content-Type": "application/json"},
        json={"title": "To delete"},
    )
    assert create.status_code == 201, create.text
    session_id = create.json()["id"]

    deleted = client.delete(
        f"/api/v1/assistant/sessions/{session_id}",
        headers=csrf_headers(client),
    )
    assert deleted.status_code == 204, deleted.text

    listed = client.get("/api/v1/assistant/sessions", headers=csrf_headers(client))
    assert listed.status_code == 200
    assert not any(s["id"] == session_id for s in listed.json())
