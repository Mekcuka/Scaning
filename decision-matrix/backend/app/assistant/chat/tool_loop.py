"""Tool execution, confirmation flow, and assistant message finalization."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

from app.assistant.chat.errors import ChatError
from app.assistant.chat.events import ChatStreamEvent
from app.assistant.chat.llm_client import (
    LlmResponse,
    is_content_safety_verdict,
    strip_text_tool_calls,
)
from app.assistant.chat.message_history import assistant_tool_message
from app.assistant.chat.pending import create_pending_action_id, verify_pending_action_id
from app.assistant.chat.schemas import (
    ChatMessage,
    ChatRequest,
    ChatResponse,
    PendingAction,
    ToolCallSummary,
)
from app.assistant.chat.tool_labels import (
    pending_description_ru,
    tool_label_ru,
)
from app.assistant.chat.user_text import polish_assistant_answer
from app.assistant.chat.tool_payload import (
    compact_tool_payload_for_llm,
    resolve_tool_arguments,
    store_tool_result_cache,
)
from app.assistant.context import ToolContext
from app.assistant.ports.tool_registry_port import ToolRegistryPort, default_tool_registry
from app.models import User

_registry: ToolRegistryPort = default_tool_registry


async def execute_tool(name: str, args: dict[str, Any], ctx: ToolContext):
    """Module-level shim — delegates to default registry (patchable in tests)."""
    return await _registry.execute_tool(name, args, ctx)


def get_tool(name: str):
    return _registry.get_tool(name)


def finalize_assistant_message(
    content: str | None,
    reasoning: str | None = None,
    *,
    request: ChatRequest | None = None,
    tool_cache: dict[str, Any] | None = None,
) -> tuple[str, str | None]:
    from app.assistant.chat.reasoning_content import merge_reasoning_text, split_reasoning_answer

    text = strip_text_tool_calls(content) or ""
    if is_content_safety_verdict(text):
        raise ChatError(
            "Модель вернула метки модерации вместо ответа. На prod укажите чат-модель, "
            "например nvidia/nemotron-nano-9b-v2:free — не openrouter/free.",
            code="llm_safety_router",
        )
    embedded_reasoning, answer = split_reasoning_answer(text)
    merged_reasoning = merge_reasoning_text(reasoning, embedded_reasoning)
    polished = polish_assistant_answer(
        answer or "",
        request=request,
        tool_cache=tool_cache,
    )
    return polished, merged_reasoning


def finalize_assistant_content(
    content: str | None,
    *,
    request: ChatRequest | None = None,
    tool_cache: dict[str, Any] | None = None,
) -> str:
    answer, _ = finalize_assistant_message(
        content,
        request=request,
        tool_cache=tool_cache,
    )
    return answer


async def execute_llm_tool_calls(
    llm: LlmResponse,
    *,
    ctx: ToolContext,
    user: User,
    request: ChatRequest,
    llm_thread: list[dict[str, Any]],
    tool_summaries: list[ToolCallSummary],
    tool_result_cache: dict[str, Any] | None = None,
    tool_registry: ToolRegistryPort | None = None,
) -> AsyncIterator[ChatStreamEvent]:
    """Run tool_calls from LLM; yields stream events. Stops after pending_action done event."""

    async def _exec(name: str, args: dict[str, Any], tool_ctx: ToolContext):
        if tool_registry is not None:
            return await tool_registry.execute_tool(name, args, tool_ctx)
        return await execute_tool(name, args, tool_ctx)

    def _get(name: str):
        if tool_registry is not None:
            return tool_registry.get_tool(name)
        return get_tool(name)

    llm_thread.append(assistant_tool_message(llm))

    for tc in llm.tool_calls:
        tool_args = await resolve_tool_arguments(ctx, tc.name, tc.arguments, request)
        defn = _get(tc.name)
        if defn and defn.mutating:
            action_id = create_pending_action_id(user.id, tc.name, tool_args)
            pending = PendingAction(
                action_id=action_id,
                tool=tc.name,
                arguments=tool_args,
                description=pending_description_ru(tc.name, defn.description),
            )
            yield ChatStreamEvent("pending_action", pending.model_dump(mode="json"))
            response = ChatResponse(
                message=ChatMessage(
                    role="assistant",
                    content=(
                        f"Нужно подтверждение: **{tool_label_ru(tc.name)}**. "
                        "Нажмите «Подтвердить» в панели помощника."
                    ),
                ),
                tool_calls_made=tool_summaries,
                pending_action=pending,
            )
            yield ChatStreamEvent("done", response.model_dump(mode="json"))
            return

        yield ChatStreamEvent("tool_start", {"name": tc.name})
        result = await _exec(tc.name, tool_args, ctx)
        tool_summaries.append(
            ToolCallSummary(name=tc.name, ok=result.ok, code=result.code)
        )
        yield ChatStreamEvent(
            "tool_done",
            {"name": tc.name, "ok": result.ok, "code": result.code},
        )
        compact = compact_tool_payload_for_llm(tc.name, result)
        if tool_result_cache is not None:
            store_tool_result_cache(
                tc.name, compact, ok=result.ok, tool_result_cache=tool_result_cache
            )
        llm_thread.append(
            {
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(compact, ensure_ascii=False),
            }
        )


async def execute_confirmed_events(
    ctx: ToolContext,
    user: User,
    confirm_action_id: str,
    *,
    request: ChatRequest | None = None,
    tool_registry: ToolRegistryPort | None = None,
) -> AsyncIterator[ChatStreamEvent]:
    async def _exec(name: str, args: dict[str, Any], tool_ctx: ToolContext):
        if tool_registry is not None:
            return await tool_registry.execute_tool(name, args, tool_ctx)
        return await execute_tool(name, args, tool_ctx)

    tool_name, arguments = verify_pending_action_id(confirm_action_id, user.id)
    confirm_ctx = ToolContext(
        user=ctx.user, db=ctx.db, env=ctx.env, tool_source="confirm"
    )
    yield ChatStreamEvent("tool_start", {"name": tool_name})
    result = await _exec(tool_name, arguments, confirm_ctx)
    summary = ToolCallSummary(name=tool_name, ok=result.ok, code=result.code)
    yield ChatStreamEvent(
        "tool_done",
        {"name": tool_name, "ok": result.ok, "code": result.code},
    )
    label = tool_label_ru(tool_name)
    if result.ok:
        text = json.dumps(result.data, ensure_ascii=False, indent=2)
        content = f"Готово: {label}.\n\n{text}"
    else:
        content = f"Не удалось выполнить «{label}»: {result.error}"
    response = ChatResponse(
        message=ChatMessage(
            role="assistant",
            content=finalize_assistant_content(content, request=request, tool_cache=None),
        ),
        tool_calls_made=[summary],
    )
    yield ChatStreamEvent("done", response.model_dump(mode="json"))
