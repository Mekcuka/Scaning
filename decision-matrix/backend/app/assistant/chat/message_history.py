"""Build LLM message lists from chat history and tool threads."""

from __future__ import annotations

import json
from typing import Any

from app.assistant.chat.llm_client import LlmResponse
from app.assistant.chat.schemas import ChatMessage


def history_message_for_llm(msg: ChatMessage) -> dict[str, str] | None:
    """Strip chain-of-thought from prior assistant turns — only answers go to the model."""
    if msg.role == "assistant":
        from app.assistant.chat.reasoning_content import split_reasoning_answer

        _embedded, answer = split_reasoning_answer(msg.content)
        text = (answer or "").strip()
        if not text:
            return None
        return {"role": "assistant", "content": text}
    text = msg.content.strip()
    if not text:
        return None
    return {"role": msg.role, "content": text}


def llm_messages(
    system_prompt: str,
    history: list[ChatMessage],
    llm_thread: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]
    for msg in history:
        item = history_message_for_llm(msg)
        if item:
            messages.append(item)
    if llm_thread:
        messages.extend(llm_thread)
    return messages


def assistant_tool_message(llm: LlmResponse) -> dict[str, Any]:
    return {
        "role": "assistant",
        "content": llm.content,
        "tool_calls": [
            {
                "id": tc.id,
                "type": "function",
                "function": {
                    "name": tc.name,
                    "arguments": json.dumps(tc.arguments, ensure_ascii=False),
                },
            }
            for tc in llm.tool_calls
        ],
    }
