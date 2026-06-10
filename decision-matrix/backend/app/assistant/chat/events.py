"""SSE / chat stream event types."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal


@dataclass(slots=True)
class ChatStreamEvent:
    kind: Literal[
        "token",
        "reasoning_token",
        "tool_start",
        "tool_done",
        "pending_action",
        "done",
        "error",
    ]
    data: dict[str, Any]
