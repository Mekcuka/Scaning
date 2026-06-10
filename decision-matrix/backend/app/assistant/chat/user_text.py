"""Polish assistant text for end users — no raw UUIDs or technical ids."""

from __future__ import annotations

import re
from typing import Any

from app.assistant.chat.schemas import ChatRequest
from app.assistant.chat.tool_labels import humanize_tool_names_in_text

_UUID_RE = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b",
    re.IGNORECASE,
)
_TECH_ID_RE = re.compile(
    r"\b(?:poi_id|project_id|job_id)\s*[=:]\s*[^\s,.;)\]]+",
    re.IGNORECASE,
)


def _name_map_from_cache(tool_cache: dict[str, Any] | None) -> dict[str, str]:
    if not tool_cache:
        return {}
    out: dict[str, str] = {}
    for tool_name in ("list_projects", "list_pois", "get_poi", "get_project"):
        data = tool_cache.get(tool_name)
        if isinstance(data, dict):
            items = data.get("preview")
            if isinstance(items, list):
                for item in items:
                    if isinstance(item, dict) and item.get("id") and item.get("name"):
                        out[str(item["id"])] = str(item["name"])
            elif tool_name == "get_poi" and data.get("id") and data.get("name"):
                out[str(data["id"])] = str(data["name"])
        elif isinstance(data, list):
            for item in data:
                if isinstance(item, dict) and item.get("id") and item.get("name"):
                    out[str(item["id"])] = str(item["name"])
    return out


def humanize_user_facing_text(
    content: str,
    *,
    request: ChatRequest | None = None,
    tool_cache: dict[str, Any] | None = None,
) -> str:
    if not content:
        return content

    out = humanize_tool_names_in_text(content)
    replacements: dict[str, str] = _name_map_from_cache(tool_cache)

    if request:
        if request.project_id and request.project_name:
            replacements[str(request.project_id)] = f"«{request.project_name}»"
        if request.selected_poi_id and request.selected_poi_name:
            replacements[str(request.selected_poi_id)] = f"«{request.selected_poi_name}»"

    for uid, label in sorted(replacements.items(), key=lambda x: len(x[0]), reverse=True):
        out = out.replace(uid, label)

    fallback_poi = (
        f"«{request.selected_poi_name}»"
        if request and request.selected_poi_name
        else None
    )
    fallback_project = (
        f"«{request.project_name}»"
        if request and request.project_name
        else None
    )

    def _replace_uuid(match: re.Match[str]) -> str:
        if fallback_poi and "poi" in out.lower():
            return fallback_poi
        if fallback_project:
            return fallback_project
        return ""

    out = _UUID_RE.sub(_replace_uuid, out)
    out = _TECH_ID_RE.sub("", out)
    out = re.sub(r"\(\s*\)", "", out)
    out = re.sub(r"\s{2,}", " ", out)
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()


def polish_assistant_answer(
    content: str,
    *,
    request: ChatRequest | None = None,
    tool_cache: dict[str, Any] | None = None,
) -> str:
    return humanize_user_facing_text(content, request=request, tool_cache=tool_cache)
