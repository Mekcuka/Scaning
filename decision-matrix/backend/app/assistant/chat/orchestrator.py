"""LLM orchestrator — tool loop over shared registry."""

from __future__ import annotations

import json
from collections import Counter
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any, Literal
from uuid import UUID

from app.assistant.chat.errors import ChatError
from app.assistant.chat.llm_client import (
    LlmResponse,
    chat_completion,
    chat_completion_stream,
    enrich_llm_response,
    is_content_safety_verdict,
    strip_text_tool_calls,
)
from app.assistant.chat.pending import create_pending_action_id, verify_pending_action_id
from app.assistant.chat.schemas import (
    ChatMessage,
    ChatRequest,
    ChatResponse,
    PendingAction,
    ToolCallSummary,
)
from app.assistant.chat.sse import format_sse
from app.assistant.chat.response_formatters import try_server_answer_after_tools
from app.assistant.chat.tool_router import select_tools_for_chat
from app.assistant.chat.tool_labels import (
    humanize_tool_names_in_text,
    pending_description_ru,
    tool_label_ru,
)
from app.assistant.context import ToolContext, ToolEnv
from app.assistant.registry import execute_tool, get_tool
from app.core.config import settings
from app.models import User
from app.models.enums import UserRole
from app.services.project_access import user_role

_DATA_HINTS = (
    "проект",
    "poi",
    "тариф",
    "задач",
    "job",
    "анализ",
    "карта",
    "объект",
    "слой",
    "сеть",
    "импорт",
    "отчёт",
    "отчет",
    "admin",
    "список",
    "покажи",
    "найди",
    "получ",
    "статус",
    "журнал",
    "отмен",
    "rates",
    "economic",
    "infra",
    "network",
    "flow",
    "sand",
    "скважин",
    "дорог",
    "3d",
    "сколько",
    "колич",
    "число",
    "посчит",
    "сосчит",
)


@dataclass(slots=True)
class ChatStreamEvent:
    kind: Literal["token", "tool_start", "tool_done", "pending_action", "done", "error"]
    data: dict[str, Any]


def _user_wants_data(messages: list[ChatMessage]) -> bool:
    """Only the latest user turn decides whether to attach tools."""
    user_msgs = [m for m in messages if m.role == "user"]
    if not user_msgs:
        return False
    text = user_msgs[-1].content.lower()
    return any(hint in text for hint in _DATA_HINTS)


def _tool_env() -> ToolEnv:
    env = settings.ENVIRONMENT
    if env in ("development", "staging", "production", "test"):
        return env  # type: ignore[return-value]
    return "development"


_TAB_HINTS: dict[str, str] = {
    "map": "Пользователь на карте — релевантны POI, слои и объекты инфраструктуры.",
    "matrix": "Пользователь в матрице решений — релевантны POI и анализ.",
    "parameters/rates": "Пользователь в тарифах проекта.",
    "flows/technology": "Пользователь в технологической схеме потоков.",
    "flows/economic": "Пользователь в экономической схеме потоков.",
    "flows/logistics": "Пользователь в логистике песка.",
    "admin/jobs": "Пользователь в админ-журнале задач.",
    "admin/users": "Пользователь в админ-панели пользователей.",
    "project-detail": "Пользователь на странице проекта с анализом POI.",
}


def _build_system_prompt(
    user: User,
    request: ChatRequest,
    ctx: ToolContext,
) -> str:
    parts = [
        "Ты AI-помощник Atlas Grid (СППР нефтегаз). Отвечай на русском.",
        "Используй tools для фактов о проектах, POI, jobs и расчётах — не выдумывай данные.",
        f"Роль пользователя: {user.role}.",
    ]
    if request.project_id:
        if request.project_name:
            parts.append(
                f"Активный проект (контекст UI): {request.project_name} ({request.project_id})."
            )
        else:
            parts.append(f"Активный проект (контекст UI): {request.project_id}.")
    if request.selected_poi_id:
        parts.append(f"Выбранный POI в UI: {request.selected_poi_id}.")
    elif request.project_id:
        parts.append(
            "Выбранный POI в UI не указан — уточни у пользователя при необходимости."
        )
    if request.active_tab:
        parts.append(f"Активная вкладка/раздел: {request.active_tab}.")
        hint = _TAB_HINTS.get(request.active_tab)
        if hint:
            parts.append(hint)
    if request.route_path:
        parts.append(f"Текущая страница: {request.route_path}.")
    parts.append(
        "Опасные операции (mutating tools) требуют подтверждения пользователя — не обходи это."
    )
    parts.append(
        "Вызывай tools только через API function calling. Не выводи сырой XML/JSON "
        "вида <tool_call> в тексте ответа."
    )
    parts.append(
        "В ответах пользователю пиши обычным русским языком — без технических имён функций "
        "(list_projects, get_autoroad_solver_status, list_infra_objects и т.п.). "
        "Не пиши «выполним запрос к …» — сразу давай результат простыми словами."
    )
    parts.append(
        "Примеры формулировок: «у вас 3 проекта», «на карте N объектов» (N из tool), «тариф переработки — …», "
        "«фоновая задача выполняется». Для job_id сначала узнай статус задачи через tool, но в тексте "
        "скажи «фоновая задача», не имя функции."
    )
    if request.project_id:
        parts.append(
            "Объекты на карте: вызови tool списка объектов инфраструктуры (видимые слои по умолчанию). "
            "Слои карты — только если спросили про сами слои. "
            "В данных tool смотри count_by_subtype / count_by_category, не экстраполируй из preview. "
            "POI — отдельным запросом списка POI. "
            f"project_id для tools: {request.project_id}, если пользователь не указал другой."
        )
    else:
        parts.append(
            "Для карты и POI нужен project_id — если проект не выбран, запроси список проектов "
            "или попроси пользователя выбрать проект в интерфейсе."
        )
    return "\n".join(parts)


def _slim_tool_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """Expose required parameters to the LLM (local models ignore empty schemas)."""
    properties = schema.get("properties") or {}
    required = [key for key in (schema.get("required") or []) if key in properties]
    slim_properties = {key: properties[key] for key in required}
    if not slim_properties:
        return {"type": "object", "properties": {}}
    payload: dict[str, Any] = {"type": "object", "properties": slim_properties}
    if required:
        payload["required"] = required
    return payload


_LIST_TOOLS_PREVIEW = 5


def _count_field(items: list[dict[str, Any]], field: str) -> dict[str, int]:
    tallies = Counter(str(item.get(field) or "unknown") for item in items)
    return dict(tallies.most_common())


def _summarize_list_for_llm(tool_name: str, items: list[Any]) -> dict[str, Any] | None:
    if not items:
        if tool_name == "list_infra_objects":
            from app.assistant.chat.response_formatters import format_infra_objects_summary

            summary: dict[str, Any] = {
                "count": 0,
                "count_by_subtype": {},
                "count_by_category": {},
                "preview": [],
                "truncated": False,
            }
            summary["formatted_summary_ru"] = format_infra_objects_summary(summary)
            return summary
        if tool_name in ("list_pois", "list_projects"):
            return {"count": 0, "preview": [], "truncated": False}
        return None
    if not isinstance(items[0], dict):
        return None
    count = len(items)
    preview = items[:_LIST_TOOLS_PREVIEW]
    if tool_name == "list_infra_objects":
        by_subtype = _count_field(items, "subtype")
        summary: dict[str, Any] = {
            "count": count,
            "count_by_subtype": by_subtype,
            "count_by_category": _count_field(items, "category"),
            "preview": preview,
            "truncated": count > len(preview),
            "note": (
                "count_by_subtype — полная агрегация по всем объектам. "
                "Не выдумывай типы; если есть formatted_summary_ru — отдай пользователю как есть."
            ),
        }
        from app.assistant.chat.response_formatters import format_infra_objects_summary

        summary["formatted_summary_ru"] = format_infra_objects_summary(summary)
        return summary
    if tool_name == "list_pois":
        summary: dict[str, Any] = {
            "count": count,
            "preview": preview,
            "truncated": count > len(preview),
        }
        if any("status" in item for item in items):
            summary["count_by_status"] = _count_field(items, "status")
        return summary
    if tool_name == "list_projects":
        return {
            "count": count,
            "preview": [{"id": item.get("id"), "name": item.get("name")} for item in preview],
            "truncated": count > len(preview),
        }
    if tool_name == "list_infra_layers":
        return {
            "count": count,
            "count_by_layer_type": _count_field(items, "layer_type"),
            "preview": preview,
            "truncated": count > len(preview),
        }
    return None


def _compact_tool_payload_for_llm(tool_name: str, result) -> dict[str, Any]:
    """Shrink large list payloads so local LLMs can report counts reliably."""
    payload = result.model_dump()
    if not result.ok or not isinstance(result.data, list):
        return payload
    items = result.data
    count = len(items)
    preview = items[:_LIST_TOOLS_PREVIEW]
    summary = _summarize_list_for_llm(tool_name, items)
    if summary is not None:
        payload["data"] = summary
    elif tool_name.startswith("list_") and count > _LIST_TOOLS_PREVIEW:
        payload["data"] = {
            "count": count,
            "preview": preview,
            "truncated": True,
        }
    return payload


def _enrich_tool_arguments(
    tool_name: str,
    arguments: dict[str, Any],
    request: ChatRequest,
) -> dict[str, Any]:
    """Fill project/poi context from UI when the model omits required ids."""
    out = dict(arguments)
    defn = get_tool(tool_name)
    if not defn:
        return out
    schema = defn.input_model.model_json_schema()
    properties = schema.get("properties") or {}
    if "project_id" in properties and not out.get("project_id") and request.project_id:
        out["project_id"] = str(request.project_id)
    if "poi_id" in properties and not out.get("poi_id") and request.selected_poi_id:
        out["poi_id"] = str(request.selected_poi_id)
    return out


def _tools_for_llm(ctx: ToolContext, request: ChatRequest) -> list[dict[str, Any]]:
    return [
        {
            "type": "function",
            "function": {
                "name": meta.name,
                "description": meta.description,
                "parameters": _slim_tool_schema(meta.input_schema),
            },
        }
        for meta in select_tools_for_chat(request, ctx)
    ]


def _store_tool_result_cache(
    tool_name: str,
    compact: dict[str, Any],
    *,
    ok: bool,
    tool_result_cache: dict[str, Any],
) -> None:
    if not ok:
        return
    data = compact.get("data")
    if tool_name == "get_project_job" and data is None:
        tool_result_cache[tool_name] = {"active": False}
        return
    if isinstance(data, dict):
        tool_result_cache[tool_name] = data
        return
    if isinstance(data, list):
        summary = _summarize_list_for_llm(tool_name, data)
        if summary is not None:
            tool_result_cache[tool_name] = summary
        else:
            preview = data[:_LIST_TOOLS_PREVIEW]
            tool_result_cache[tool_name] = {
                "count": len(data),
                "preview": preview,
                "truncated": len(data) > len(preview),
            }


def _llm_messages(
    system_prompt: str,
    history: list[ChatMessage],
    llm_thread: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})
    if llm_thread:
        messages.extend(llm_thread)
    return messages


def _assistant_tool_message(llm: LlmResponse) -> dict[str, Any]:
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


async def _execute_llm_tool_calls(
    llm: LlmResponse,
    *,
    ctx: ToolContext,
    user: User,
    request: ChatRequest,
    llm_thread: list[dict[str, Any]],
    tool_summaries: list[ToolCallSummary],
    tool_result_cache: dict[str, Any] | None = None,
) -> AsyncIterator[ChatStreamEvent]:
    """Run tool_calls from LLM; yields stream events. Stops after pending_action done event."""
    llm_thread.append(_assistant_tool_message(llm))

    for tc in llm.tool_calls:
        tool_args = _enrich_tool_arguments(tc.name, tc.arguments, request)
        defn = get_tool(tc.name)
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
        result = await execute_tool(tc.name, tool_args, ctx)
        tool_summaries.append(
            ToolCallSummary(name=tc.name, ok=result.ok, code=result.code)
        )
        yield ChatStreamEvent(
            "tool_done",
            {"name": tc.name, "ok": result.ok, "code": result.code},
        )
        compact = _compact_tool_payload_for_llm(tc.name, result)
        if tool_result_cache is not None:
            _store_tool_result_cache(
                tc.name, compact, ok=result.ok, tool_result_cache=tool_result_cache
            )
        llm_thread.append(
            {
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(compact, ensure_ascii=False),
            }
        )


def _finalize_assistant_content(content: str | None) -> str:
    text = strip_text_tool_calls(content) or ""
    if is_content_safety_verdict(text):
        raise ChatError(
            "Модель вернула метки модерации вместо ответа. На prod укажите чат-модель, "
            "например nvidia/nemotron-nano-9b-v2:free — не openrouter/free.",
            code="llm_safety_router",
        )
    return humanize_tool_names_in_text(text)


async def _execute_confirmed_events(
    ctx: ToolContext,
    user: User,
    confirm_action_id: str,
) -> AsyncIterator[ChatStreamEvent]:
    tool_name, arguments = verify_pending_action_id(confirm_action_id, user.id)
    confirm_ctx = ToolContext(
        user=ctx.user, db=ctx.db, env=ctx.env, tool_source="confirm"
    )
    yield ChatStreamEvent("tool_start", {"name": tool_name})
    result = await execute_tool(tool_name, arguments, confirm_ctx)
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
        message=ChatMessage(role="assistant", content=_finalize_assistant_content(content)),
        tool_calls_made=[summary],
    )
    yield ChatStreamEvent("done", response.model_dump(mode="json"))


async def _chat_events(
    user: User,
    db,
    request: ChatRequest,
    *,
    stream_final: bool,
) -> AsyncIterator[ChatStreamEvent]:
    ctx = ToolContext(user=user, db=db, env=_tool_env(), tool_source="chat")

    if request.confirm_action_id:
        async for event in _execute_confirmed_events(ctx, user, request.confirm_action_id):
            yield event
        return

    system_prompt = _build_system_prompt(user, request, ctx)
    attach_tools = _user_wants_data(request.messages)
    tools = _tools_for_llm(ctx, request) if attach_tools else None
    llm_thread: list[dict[str, Any]] = []
    tool_summaries: list[ToolCallSummary] = []
    tool_result_cache: dict[str, Any] = {}

    max_rounds = (
        settings.ASSISTANT_CHAT_MAX_TOOL_ROUNDS_VIEWER
        if user_role(user) == UserRole.viewer
        else settings.ASSISTANT_CHAT_MAX_TOOL_ROUNDS
    )
    for _ in range(max_rounds):
        # Tools only on the first round; after tool results we synthesize without tools.
        round_tools = tools if attach_tools and not llm_thread else None
        messages = _llm_messages(system_prompt, request.messages, llm_thread)

        if round_tools:
            llm: LlmResponse = enrich_llm_response(
                await chat_completion(messages, tools=round_tools)
            )
            if llm.tool_calls:
                pending_done = False
                async for event in _execute_llm_tool_calls(
                    llm,
                    ctx=ctx,
                    user=user,
                    request=request,
                    llm_thread=llm_thread,
                    tool_summaries=tool_summaries,
                    tool_result_cache=tool_result_cache,
                ):
                    yield event
                    if event.kind == "done":
                        pending_done = True
                if pending_done:
                    return
                continue

            if llm.content:
                content = _finalize_assistant_content(llm.content)
                if stream_final and content:
                    yield ChatStreamEvent("token", {"delta": content})
                response = ChatResponse(
                    message=ChatMessage(role="assistant", content=content),
                    tool_calls_made=tool_summaries,
                )
                yield ChatStreamEvent("done", response.model_dump(mode="json"))
                return
            if not stream_final:
                yield ChatStreamEvent(
                    "error",
                    {"message": "LLM returned empty response", "code": "llm_empty"},
                )
                return

        messages = _llm_messages(system_prompt, request.messages, llm_thread)

        # After tool results: prefer server-formatted answer for map object counts.
        if llm_thread:
            server_content = try_server_answer_after_tools(
                request, tool_summaries, tool_result_cache
            )
            if server_content:
                if stream_final:
                    yield ChatStreamEvent("token", {"delta": server_content})
                response = ChatResponse(
                    message=ChatMessage(role="assistant", content=server_content),
                    tool_calls_made=tool_summaries,
                )
                yield ChatStreamEvent("done", response.model_dump(mode="json"))
                return

            llm = enrich_llm_response(await chat_completion(messages, tools=None))
            if llm.tool_calls:
                pending_done = False
                async for event in _execute_llm_tool_calls(
                    llm,
                    ctx=ctx,
                    user=user,
                    request=request,
                    llm_thread=llm_thread,
                    tool_summaries=tool_summaries,
                    tool_result_cache=tool_result_cache,
                ):
                    yield event
                    if event.kind == "done":
                        pending_done = True
                if pending_done:
                    return
                continue

            content = _finalize_assistant_content(llm.content)
            if content:
                if stream_final:
                    yield ChatStreamEvent("token", {"delta": content})
                response = ChatResponse(
                    message=ChatMessage(role="assistant", content=content),
                    tool_calls_made=tool_summaries,
                )
                yield ChatStreamEvent("done", response.model_dump(mode="json"))
                return
            yield ChatStreamEvent(
                "error",
                {"message": "LLM returned empty response", "code": "llm_empty"},
            )
            return

        if stream_final:
            content_parts: list[str] = []
            async for delta in chat_completion_stream(messages, tools=None):
                content_parts.append(delta)
                yield ChatStreamEvent("token", {"delta": delta})
            content = _finalize_assistant_content("".join(content_parts))
            if content:
                response = ChatResponse(
                    message=ChatMessage(role="assistant", content=content),
                    tool_calls_made=tool_summaries,
                )
                yield ChatStreamEvent("done", response.model_dump(mode="json"))
                return
        else:
            llm = enrich_llm_response(await chat_completion(messages, tools=None))
            if llm.tool_calls:
                pending_done = False
                async for event in _execute_llm_tool_calls(
                    llm,
                    ctx=ctx,
                    user=user,
                    request=request,
                    llm_thread=llm_thread,
                    tool_summaries=tool_summaries,
                    tool_result_cache=tool_result_cache,
                ):
                    yield event
                    if event.kind == "done":
                        pending_done = True
                if pending_done:
                    return
                continue
            content = _finalize_assistant_content(llm.content)
            if content:
                response = ChatResponse(
                    message=ChatMessage(role="assistant", content=content),
                    tool_calls_made=tool_summaries,
                )
                yield ChatStreamEvent("done", response.model_dump(mode="json"))
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


async def run_chat(user: User, db, request: ChatRequest) -> ChatResponse:
    content_parts: list[str] = []
    final_response: ChatResponse | None = None

    async for event in _chat_events(user, db, request, stream_final=False):
        if event.kind == "token":
            content_parts.append(event.data.get("delta", ""))
        elif event.kind == "error":
            raise ChatError(event.data.get("message", "Chat error"), code=event.data.get("code"))
        elif event.kind == "done":
            final_response = ChatResponse.model_validate(event.data)

    if final_response:
        if content_parts and not final_response.message.content:
            final_response.message.content = "".join(content_parts)
        return final_response

    raise ChatError("Chat ended without response", code="llm_empty")


async def run_chat_stream(user: User, db, request: ChatRequest) -> AsyncIterator[str]:
    try:
        async for event in _chat_events(user, db, request, stream_final=True):
            yield format_sse(event.kind, event.data)
    except ChatError as e:
        yield format_sse("error", {"message": e.message, "code": e.code})
    except Exception as e:
        yield format_sse(
            "error",
            {"message": f"Chat failed: {e}", "code": "chat_internal"},
        )
