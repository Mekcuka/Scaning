"""LLM orchestrator — tool loop over shared registry."""

from __future__ import annotations

from collections.abc import AsyncIterator

from app.assistant.chat.errors import ChatError
from app.assistant.chat.events import ChatStreamEvent
from app.assistant.chat.history import with_persisted_done
from app.assistant.chat.formatters.registry import try_server_answer_after_tools
from app.assistant.chat.llm_client import enrich_llm_response
from app.assistant.chat.ports.llm_port import LlmClientPort, default_llm_client
from app.assistant.ports.tool_registry_port import ToolRegistryPort
from app.assistant.chat.message_history import llm_messages
from app.assistant.chat.prompt import build_system_prompt, tool_env, user_wants_data
from app.assistant.chat.reasoning_content import ReasoningStreamSplitter
from app.assistant.chat.schemas import (
    ChatMessage,
    ChatRequest,
    ChatResponse,
    ToolCallSummary,
)
from app.assistant.chat.sse import format_sse
from app.assistant.chat.tool_loop import (
    execute_confirmed_events,
    execute_llm_tool_calls,
    finalize_assistant_message,
)
from app.assistant.chat.user_text import polish_assistant_answer
from app.assistant.chat.tool_payload import (
    compact_tool_payload_for_llm,
    enrich_tool_arguments,
    tools_for_llm,
)
from app.assistant.context import ToolContext
from app.core.config import settings
from app.models import User
from app.models.enums import UserRole
from app.services.project_access import user_role

# Re-exports for tests and backward compatibility (SOLID phase 7 barrel).
_user_wants_data = user_wants_data
_compact_tool_payload_for_llm = compact_tool_payload_for_llm
_enrich_tool_arguments = enrich_tool_arguments

from app.assistant.chat.message_history import history_message_for_llm as _history_message_for_llm  # noqa: E402

_llm: LlmClientPort = default_llm_client


async def _emit_done(db, user: User, request: ChatRequest, response: ChatResponse) -> ChatStreamEvent:
    persisted = await with_persisted_done(db, user.id, request, response)
    return ChatStreamEvent("done", persisted.model_dump(mode="json"))


async def chat_completion(messages, tools=None):
    """Module-level shim for tests (@patch orchestrator.chat_completion)."""
    return await _llm.chat_completion(messages, tools=tools)


async def chat_completion_stream(messages, tools=None):
    """Module-level shim for tests (@patch orchestrator.chat_completion_stream)."""
    async for chunk in _llm.chat_completion_stream(messages, tools=tools):
        yield chunk


async def _chat_events(
    user: User,
    db,
    request: ChatRequest,
    *,
    stream_final: bool,
    llm_client: LlmClientPort | None = None,
    tool_registry: ToolRegistryPort | None = None,
) -> AsyncIterator[ChatStreamEvent]:
    async def _complete(messages, tools=None):
        if llm_client is not None:
            return await llm_client.chat_completion(messages, tools=tools)
        return await chat_completion(messages, tools=tools)

    async def _stream(messages, tools=None):
        if llm_client is not None:
            async for chunk in llm_client.chat_completion_stream(messages, tools=tools):
                yield chunk
            return
        async for chunk in chat_completion_stream(messages, tools=tools):
            yield chunk

    ctx = ToolContext(user=user, db=db, env=tool_env(), tool_source="chat")

    if request.confirm_action_id:
        async for event in execute_confirmed_events(
            ctx,
            user,
            request.confirm_action_id,
            request=request,
            tool_registry=tool_registry,
        ):
            if event.kind == "done":
                yield await _emit_done(
                    db, user, request, ChatResponse.model_validate(event.data)
                )
            else:
                yield event
        return

    system_prompt = build_system_prompt(user, request, ctx)
    attach_tools = user_wants_data(request.messages)
    tools = tools_for_llm(ctx, request) if attach_tools else None
    llm_thread: list = []
    tool_summaries: list[ToolCallSummary] = []
    tool_result_cache: dict = {}

    max_rounds = (
        settings.ASSISTANT_CHAT_MAX_TOOL_ROUNDS_VIEWER
        if user_role(user) == UserRole.viewer
        else settings.ASSISTANT_CHAT_MAX_TOOL_ROUNDS
    )
    for _ in range(max_rounds):
        round_tools = tools if attach_tools and not llm_thread else None
        messages = llm_messages(system_prompt, request.messages, llm_thread)

        if round_tools:
            llm = enrich_llm_response(
                await _complete(messages, tools=round_tools)
            )
            if llm.tool_calls:
                pending_done = False
                async for event in execute_llm_tool_calls(
                    llm,
                    ctx=ctx,
                    user=user,
                    request=request,
                    llm_thread=llm_thread,
                    tool_summaries=tool_summaries,
                    tool_result_cache=tool_result_cache,
                    tool_registry=tool_registry,
                ):
                    yield event
                    if event.kind == "done":
                        pending_done = True
                if pending_done:
                    return
                continue

            if llm.content or llm.reasoning:
                content, reasoning = finalize_assistant_message(
                    llm.content,
                    llm.reasoning,
                    request=request,
                    tool_cache=tool_result_cache,
                )
                if stream_final and content:
                    yield ChatStreamEvent("token", {"delta": content})
                response = ChatResponse(
                    message=ChatMessage(
                        role="assistant", content=content, reasoning=reasoning
                    ),
                    tool_calls_made=tool_summaries,
                    answer_source="llm",
                )
                yield await _emit_done(db, user, request, response)
                return
            if not stream_final:
                yield ChatStreamEvent(
                    "error",
                    {"message": "LLM returned empty response", "code": "llm_empty"},
                )
                return

        messages = llm_messages(system_prompt, request.messages, llm_thread)

        if llm_thread:
            server_content, answer_source = try_server_answer_after_tools(
                request, tool_summaries, tool_result_cache
            )
            if server_content:
                server_content = polish_assistant_answer(
                    server_content,
                    request=request,
                    tool_cache=tool_result_cache,
                )
                if stream_final:
                    yield ChatStreamEvent("token", {"delta": server_content})
                response = ChatResponse(
                    message=ChatMessage(role="assistant", content=server_content),
                    tool_calls_made=tool_summaries,
                    answer_source=answer_source or "formatter",
                )
                yield await _emit_done(db, user, request, response)
                return

            llm = enrich_llm_response(await _complete(messages, tools=None))
            if llm.tool_calls:
                pending_done = False
                async for event in execute_llm_tool_calls(
                    llm,
                    ctx=ctx,
                    user=user,
                    request=request,
                    llm_thread=llm_thread,
                    tool_summaries=tool_summaries,
                    tool_result_cache=tool_result_cache,
                    tool_registry=tool_registry,
                ):
                    yield event
                    if event.kind == "done":
                        pending_done = True
                if pending_done:
                    return
                continue

            content, reasoning = finalize_assistant_message(
                llm.content,
                llm.reasoning,
                request=request,
                tool_cache=tool_result_cache,
            )
            if content or reasoning:
                if stream_final:
                    yield ChatStreamEvent("token", {"delta": content})
                response = ChatResponse(
                    message=ChatMessage(
                        role="assistant", content=content, reasoning=reasoning
                    ),
                    tool_calls_made=tool_summaries,
                    answer_source="llm",
                )
                yield await _emit_done(db, user, request, response)
                return
            yield ChatStreamEvent(
                "error",
                {"message": "LLM returned empty response", "code": "llm_empty"},
            )
            return

        if stream_final:
            splitter = ReasoningStreamSplitter()
            content_parts: list[str] = []
            reasoning_parts: list[str] = []
            async for chunk in _stream(messages, tools=None):
                for kind, delta in splitter.feed_chunk(
                    content=chunk.content, reasoning=chunk.reasoning
                ):
                    if kind == "reasoning":
                        reasoning_parts.append(delta)
                        yield ChatStreamEvent("reasoning_token", {"delta": delta})
                    else:
                        content_parts.append(delta)
                        yield ChatStreamEvent("token", {"delta": delta})
            for kind, delta in splitter.flush():
                if kind == "reasoning":
                    reasoning_parts.append(delta)
                    yield ChatStreamEvent("reasoning_token", {"delta": delta})
                else:
                    content_parts.append(delta)
                    yield ChatStreamEvent("token", {"delta": delta})
            reasoning_raw = "".join(reasoning_parts).strip() or None
            content, reasoning = finalize_assistant_message(
                "".join(content_parts),
                reasoning_raw,
                request=request,
                tool_cache=tool_result_cache,
            )
            if content or reasoning:
                response = ChatResponse(
                    message=ChatMessage(
                        role="assistant", content=content, reasoning=reasoning
                    ),
                    tool_calls_made=tool_summaries,
                    answer_source="llm",
                )
                yield await _emit_done(db, user, request, response)
                return
        else:
            llm = enrich_llm_response(await _complete(messages, tools=None))
            if llm.tool_calls:
                pending_done = False
                async for event in execute_llm_tool_calls(
                    llm,
                    ctx=ctx,
                    user=user,
                    request=request,
                    llm_thread=llm_thread,
                    tool_summaries=tool_summaries,
                    tool_result_cache=tool_result_cache,
                    tool_registry=tool_registry,
                ):
                    yield event
                    if event.kind == "done":
                        pending_done = True
                if pending_done:
                    return
                continue
            content, reasoning = finalize_assistant_message(
                llm.content,
                llm.reasoning,
                request=request,
                tool_cache=tool_result_cache,
            )
            if content or reasoning:
                response = ChatResponse(
                    message=ChatMessage(
                        role="assistant", content=content, reasoning=reasoning
                    ),
                    tool_calls_made=tool_summaries,
                    answer_source="llm",
                )
                yield await _emit_done(db, user, request, response)
                return

        yield ChatStreamEvent(
            "error",
            {"message": "LLM returned empty response", "code": "llm_empty"},
        )
        return

    yield ChatStreamEvent(
        "error",
        {"message": "Too many tool rounds", "code": "tool_limit"},
    )


async def run_chat(
    user: User,
    db,
    request: ChatRequest,
    *,
    llm_client: LlmClientPort | None = None,
    tool_registry: ToolRegistryPort | None = None,
) -> ChatResponse:
    content_parts: list[str] = []
    final_response: ChatResponse | None = None

    async for event in _chat_events(
        user,
        db,
        request,
        stream_final=False,
        llm_client=llm_client,
        tool_registry=tool_registry,
    ):
        if event.kind == "token":
            content_parts.append(event.data.get("delta", ""))
        elif event.kind == "error":
            raise ChatError(event.data.get("message", "Chat error"), code=event.data.get("code"))
        elif event.kind == "done":
            final_response = ChatResponse.model_validate(event.data)
            # Persisted in _emit_done during _chat_events

    if final_response:
        if content_parts and not final_response.message.content:
            final_response.message.content = "".join(content_parts)
        return final_response

    raise ChatError("Chat ended without response", code="llm_empty")


async def run_chat_stream(
    user: User,
    db,
    request: ChatRequest,
    *,
    llm_client: LlmClientPort | None = None,
    tool_registry: ToolRegistryPort | None = None,
) -> AsyncIterator[str]:
    try:
        async for event in _chat_events(
            user,
            db,
            request,
            stream_final=True,
            llm_client=llm_client,
            tool_registry=tool_registry,
        ):
            yield format_sse(event.kind, event.data)
    except ChatError as e:
        yield format_sse("error", {"message": e.message, "code": e.code})
    except Exception as e:
        yield format_sse(
            "error",
            {"message": f"Chat failed: {e}", "code": "chat_internal"},
        )
