"""Signed pending-action tokens for mutating tool confirmation."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any
from uuid import UUID

from app.assistant.chat.errors import ChatError
from app.core.config import settings

_TTL_SECONDS = 600


def _sign(payload: str) -> str:
    return hmac.new(
        settings.SECRET_KEY.encode(),
        payload.encode(),
        hashlib.sha256,
    ).hexdigest()


def create_pending_action_id(user_id: UUID, tool: str, arguments: dict[str, Any]) -> str:
    body = {
        "sub": str(user_id),
        "tool": tool,
        "args": arguments,
        "exp": int(time.time()) + _TTL_SECONDS,
    }
    payload = json.dumps(body, sort_keys=True, separators=(",", ":"))
    token = base64.urlsafe_b64encode(
        json.dumps({"p": payload, "s": _sign(payload)}).encode()
    ).decode()
    return token


def verify_pending_action_id(action_id: str, user_id: UUID) -> tuple[str, dict[str, Any]]:
    try:
        wrapper = json.loads(base64.urlsafe_b64decode(action_id.encode()))
        payload = wrapper["p"]
        sig = wrapper["s"]
    except (KeyError, ValueError, json.JSONDecodeError) as e:
        raise ChatError("Invalid confirmation token", code="invalid_confirm") from e

    if not hmac.compare_digest(_sign(payload), sig):
        raise ChatError("Invalid confirmation token", code="invalid_confirm")

    body = json.loads(payload)
    if body.get("sub") != str(user_id):
        raise ChatError("Confirmation token user mismatch", code="invalid_confirm")
    if int(body.get("exp", 0)) < int(time.time()):
        raise ChatError("Confirmation token expired", code="confirm_expired")

    tool = body.get("tool")
    args = body.get("args")
    if not tool or not isinstance(args, dict):
        raise ChatError("Invalid confirmation payload", code="invalid_confirm")
    return tool, args
