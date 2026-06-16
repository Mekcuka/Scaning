"""WebSocket endpoint for realtime job events.

Route: /api/v1/projects/{project_id}/jobs/ws?token=<JWT>
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.job_events import hub, start_redis_bridge
from app.services.job_ws_auth import get_user_from_ws_token, project_exists, user_can_read_project

logger = logging.getLogger(__name__)

jobs_ws_router = APIRouter()

HEARTBEAT_SECONDS = 30


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _event_matches_filter(event: dict, filter_job_id: str | None) -> bool:
    if not filter_job_id:
        return True
    return str(event.get("job_id") or "") == filter_job_id


@jobs_ws_router.websocket("/projects/{project_id}/jobs/ws")
async def jobs_websocket(websocket: WebSocket, project_id: UUID) -> None:
    token = websocket.query_params.get("token")
    user = await get_user_from_ws_token(token)
    if user is None:
        await websocket.close(code=4401)
        return

    if not await project_exists(project_id):
        await websocket.close(code=4404)
        return

    if not await user_can_read_project(user, project_id):
        await websocket.close(code=4403)
        return

    await websocket.accept()
    start_redis_bridge()

    queue = await hub.subscribe(project_id)
    filter_job_id: str | None = None

    await websocket.send_text(json.dumps({"type": "ready", "project_id": str(project_id)}))

    async def heartbeat() -> None:
        while True:
            await asyncio.sleep(HEARTBEAT_SECONDS)
            try:
                await websocket.send_text(json.dumps({"type": "ping"}))
            except Exception:
                return

    async def read_client() -> None:
        nonlocal filter_job_id
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "error",
                            "code": "bad_message",
                            "message": "Невалидный JSON",
                        }
                    )
                )
                continue
            msg_type = msg.get("type")
            if msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong", "server_time": _now_iso()}))
            elif msg_type == "subscribe":
                raw_job_id = msg.get("job_id")
                filter_job_id = str(raw_job_id) if raw_job_id else None
            elif msg_type == "pong":
                continue
            else:
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "error",
                            "code": "bad_message",
                            "message": f"Неизвестный тип сообщения: {msg_type}",
                        }
                    )
                )

    async def forward_events() -> None:
        while True:
            event = await queue.get()
            if not _event_matches_filter(event, filter_job_id):
                continue
            await websocket.send_text(json.dumps(event, default=str))

    hb_task = asyncio.create_task(heartbeat())
    reader_task = asyncio.create_task(read_client())
    forward_task = asyncio.create_task(forward_events())
    try:
        done, pending = await asyncio.wait(
            {reader_task, forward_task},
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()
        for task in done:
            if task.exception() and not isinstance(task.exception(), WebSocketDisconnect):
                raise task.exception()
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("jobs ws error for project %s", project_id)
    finally:
        hb_task.cancel()
        reader_task.cancel()
        forward_task.cancel()
        for task in (hb_task, reader_task, forward_task):
            try:
                await task
            except (asyncio.CancelledError, WebSocketDisconnect, Exception):
                pass
        await hub.unsubscribe(project_id, queue)
        try:
            await websocket.close()
        except Exception:
            pass
