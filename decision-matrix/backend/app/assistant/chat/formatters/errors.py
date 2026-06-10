"""Format failed tool calls without an LLM round."""

from __future__ import annotations

from app.assistant.chat.schemas import ChatRequest, ToolCallSummary
from app.assistant.chat.tool_labels import tool_label_ru

_CODE_MESSAGES_RU: dict[str, str] = {
    "not_found": "Объект не найден.",
    "forbidden": "Недостаточно прав для этой операции.",
    "validation": "Некорректные параметры запроса.",
    "conflict": "Операция конфликтует с текущим состоянием.",
    "timeout": "Превышено время ожидания.",
    "internal": "Внутренняя ошибка сервера.",
}


def _error_message_ru(summary: ToolCallSummary, cache: dict) -> str:
    label = tool_label_ru(summary.name)
    payload = cache.get(summary.name)
    if isinstance(payload, dict):
        if payload.get("error_message"):
            return f"Не удалось выполнить «{label}»: {payload['error_message']}"
        if payload.get("error"):
            return f"Не удалось выполнить «{label}»: {payload['error']}"
    code = summary.code or "error"
    hint = _CODE_MESSAGES_RU.get(code, f"Код ошибки: {code}.")
    return f"Не удалось выполнить «{label}». {hint}"


def try_tool_error_answer(
    request: ChatRequest,
    tool_summaries: list[ToolCallSummary],
    tool_result_cache: dict,
) -> str | None:
    """When a single tool failed, return a Russian error without calling the LLM."""
    if len(tool_summaries) != 1:
        return None
    summary = tool_summaries[0]
    if summary.ok:
        return None
    return _error_message_ru(summary, tool_result_cache)
