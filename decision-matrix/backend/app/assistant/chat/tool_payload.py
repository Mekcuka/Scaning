"""Slim tool schemas and compact payloads for the LLM context window."""

from __future__ import annotations

from collections import Counter
from typing import Any
from uuid import UUID

from app.assistant.chat.poi_resolve import find_poi_by_name, normalize_poi_lookup_name
from app.assistant.chat.schemas import ChatRequest
from app.assistant.chat.tool_router import select_tools_for_chat
from app.assistant.context import ToolContext
from app.assistant.registry import get_tool

_LIST_TOOLS_PREVIEW = 5

_LLM_PARAM_HINTS: dict[str, str] = {
    "poi_id": (
        "Имя POI как в интерфейсе (например Точка_1). "
        "Можно не указывать, если POI уже выбран в UI."
    ),
    "project_id": "Подставляется из UI автоматически, если проект выбран.",
    "job_id": "Из журнала задач; не сообщай этот идентификатор пользователю.",
}


def slim_tool_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """Expose required parameters to the LLM (local models ignore empty schemas)."""
    properties = schema.get("properties") or {}
    required = [key for key in (schema.get("required") or []) if key in properties]
    slim_properties: dict[str, Any] = {}
    for key in required:
        prop = dict(properties[key])
        hint = _LLM_PARAM_HINTS.get(key)
        if hint:
            prop["description"] = hint
        if key == "poi_id":
            prop.pop("format", None)
        slim_properties[key] = prop
    if not slim_properties:
        return {"type": "object", "properties": {}}
    payload: dict[str, Any] = {"type": "object", "properties": slim_properties}
    if required:
        payload["required"] = required
    return payload


def count_field(items: list[dict[str, Any]], field: str) -> dict[str, int]:
    tallies = Counter(str(item.get(field) or "unknown") for item in items)
    return dict(tallies.most_common())


def summarize_list_for_llm(tool_name: str, items: list[Any]) -> dict[str, Any] | None:
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
        by_subtype = count_field(items, "subtype")
        summary: dict[str, Any] = {
            "count": count,
            "count_by_subtype": by_subtype,
            "count_by_category": count_field(items, "category"),
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
        eng_fields = (
            "eng_power",
            "eng_injection",
            "eng_gas",
            "eng_oil_preparation",
            "eng_well_gathering",
            "eng_transport",
        )
        summary: dict[str, Any] = {
            "count": count,
            "preview": [
                {k: item.get(k) for k in ("id", "name", *eng_fields) if item.get(k) is not None}
                for item in preview
            ],
            "truncated": count > len(preview),
        }
        if any("status" in item for item in items):
            summary["count_by_status"] = count_field(items, "status")
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
            "count_by_layer_type": count_field(items, "layer_type"),
            "preview": preview,
            "truncated": count > len(preview),
        }
    if tool_name in (
        "list_one_pagers",
        "list_import_logs",
        "list_import_connections",
        "list_networks",
        "list_map3d_custom_models",
    ):
        return {
            "count": count,
            "preview": preview,
            "truncated": count > len(preview),
        }
    if tool_name == "get_poi_candidates":
        return {
            "count": count,
            "preview": preview,
            "truncated": count > len(preview),
        }
    return None


def compact_tool_payload_for_llm(tool_name: str, result) -> dict[str, Any]:
    """Shrink large list payloads so local LLMs can report counts reliably."""
    payload = result.model_dump()
    if not result.ok or not isinstance(result.data, list):
        return payload
    items = result.data
    count = len(items)
    preview = items[:_LIST_TOOLS_PREVIEW]
    summary = summarize_list_for_llm(tool_name, items)
    if summary is not None:
        payload["data"] = summary
    elif tool_name.startswith("list_") and count > _LIST_TOOLS_PREVIEW:
        payload["data"] = {
            "count": count,
            "preview": preview,
            "truncated": True,
        }
    return payload


def _is_uuid(value: Any) -> bool:
    try:
        UUID(str(value))
        return True
    except (TypeError, ValueError):
        return False


def enrich_tool_arguments(
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


async def resolve_tool_arguments(
    ctx: ToolContext,
    tool_name: str,
    arguments: dict[str, Any],
    request: ChatRequest,
) -> dict[str, Any]:
    """Enrich UI context and map POI names to UUIDs before Pydantic validation."""
    out = enrich_tool_arguments(tool_name, arguments, request)
    defn = get_tool(tool_name)
    if not defn:
        return out
    properties = defn.input_model.model_json_schema().get("properties") or {}
    if "poi_id" not in properties:
        return out

    raw_poi = out.get("poi_id")
    if raw_poi and _is_uuid(raw_poi):
        return out

    project_raw = out.get("project_id") or request.project_id
    if not project_raw:
        return out
    project_id = UUID(str(project_raw))

    if request.selected_poi_id:
        ui_name = (request.selected_poi_name or "").strip()
        raw_name = str(raw_poi or "").strip()
        if not raw_poi:
            out["poi_id"] = str(request.selected_poi_id)
            return out
        if ui_name and (
            raw_name.lower() == ui_name.lower()
            or normalize_poi_lookup_name(raw_name) == normalize_poi_lookup_name(ui_name)
        ):
            out["poi_id"] = str(request.selected_poi_id)
            return out

    if raw_poi:
        poi = await find_poi_by_name(ctx.db, project_id, str(raw_poi))
        if poi:
            out["poi_id"] = str(poi.id)

    return out


def tools_for_llm(ctx: ToolContext, request: ChatRequest) -> list[dict[str, Any]]:
    return [
        {
            "type": "function",
            "function": {
                "name": meta.name,
                "description": meta.description,
                "parameters": slim_tool_schema(meta.input_schema),
            },
        }
        for meta in select_tools_for_chat(request, ctx)
    ]


def store_tool_result_cache(
    tool_name: str,
    compact: dict[str, Any],
    *,
    ok: bool,
    tool_result_cache: dict[str, Any],
) -> None:
    if not ok:
        tool_result_cache[tool_name] = {
            "error": True,
            "code": compact.get("code"),
            "error_message": compact.get("error"),
        }
        return
    data = compact.get("data")
    if tool_name == "get_project_job" and data is None:
        tool_result_cache[tool_name] = {"active": False}
        return
    if isinstance(data, dict):
        tool_result_cache[tool_name] = data
        return
    if isinstance(data, list):
        summary = summarize_list_for_llm(tool_name, data)
        if summary is not None:
            tool_result_cache[tool_name] = summary
        else:
            preview = data[:_LIST_TOOLS_PREVIEW]
            tool_result_cache[tool_name] = {
                "count": len(data),
                "preview": preview,
                "truncated": len(data) > len(preview),
            }
