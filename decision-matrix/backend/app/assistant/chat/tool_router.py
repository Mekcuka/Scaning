"""Category-based tool routing for assistant chat (phase 7.1)."""

from __future__ import annotations

from app.assistant.chat.schemas import ChatRequest
from app.assistant.context import ToolContext
from app.assistant.registry import get_tool, list_tools
from app.assistant.schemas import ToolMeta
from app.assistant.tools.categories import (
    CAT_ADMIN,
    CAT_ANALYSIS,
    CAT_FLOW,
    CAT_JOBS,
    CAT_MAP,
    CAT_PROJECTS,
    CAT_RATES,
    CAT_SESSION,
)
from app.core.config import settings

_CORE_TOOLS_NO_PROJECT = frozenset({"list_projects", "get_me"})
_FALLBACK_WITH_PROJECT = ("list_projects", "get_project", "list_infra_objects")
_MIN_ROUTED_TOOLS = 3

_PRIORITY_READ_TOOLS: tuple[str, ...] = (
    "list_projects",
    "get_me",
    "get_project",
    "list_infra_objects",
    "list_pois",
    "get_cost_rates",
    "get_economic_params",
    "get_project_job",
    "list_project_jobs",
    "get_poi_analysis",
    "list_infra_layers",
)

_TAB_CATEGORIES: dict[str, frozenset[str]] = {
    "map": frozenset({CAT_MAP, CAT_ANALYSIS, CAT_PROJECTS}),
    "matrix": frozenset({CAT_ANALYSIS, CAT_PROJECTS}),
    "parameters/rates": frozenset({CAT_RATES, CAT_PROJECTS}),
    "flows/technology": frozenset({CAT_FLOW, CAT_ANALYSIS, CAT_PROJECTS}),
    "flows/economic": frozenset({CAT_FLOW, CAT_RATES, CAT_PROJECTS}),
    "flows/logistics": frozenset({CAT_FLOW, CAT_PROJECTS}),
    "admin/jobs": frozenset({CAT_ADMIN, CAT_JOBS}),
    "admin/users": frozenset({CAT_ADMIN}),
    "project-detail": frozenset({CAT_ANALYSIS, CAT_PROJECTS}),
}

_KEYWORD_CATEGORIES: list[tuple[tuple[str, ...], frozenset[str]]] = [
    (("проект", "project"), frozenset({CAT_PROJECTS})),
    (("poi", "точк", "скважин"), frozenset({CAT_PROJECTS, CAT_ANALYSIS})),
    (("карта", "объект", "инфраструктур", "слой", "на карте"), frozenset({CAT_MAP})),
    (("задач", "job", "фонов", "журнал"), frozenset({CAT_JOBS})),
    (("тариф", "ставк", "rates", "цен", "эконом", "opex"), frozenset({CAT_RATES})),
    (("анализ", "кандидат", "матриц"), frozenset({CAT_ANALYSIS})),
    (("поток", "схем", "логистик", "песок", "sand"), frozenset({CAT_FLOW})),
    (("импорт", "import"), frozenset({CAT_PROJECTS})),
    (("сеть", "network", "автодорог"), frozenset({CAT_MAP, CAT_ANALYSIS})),
    (("admin", "админ", "пользовател"), frozenset({CAT_ADMIN})),
    (("статус", "solver"), frozenset({CAT_SESSION, CAT_JOBS})),
]


def _last_user_text(request: ChatRequest) -> str:
    user_msgs = [m for m in request.messages if m.role == "user"]
    return user_msgs[-1].content.lower() if user_msgs else ""


def _wanted_categories(request: ChatRequest) -> frozenset[str]:
    text = _last_user_text(request)
    categories: set[str] = set()
    if request.active_tab and request.active_tab in _TAB_CATEGORIES:
        categories.update(_TAB_CATEGORIES[request.active_tab])
    for hints, cats in _KEYWORD_CATEGORIES:
        if any(hint in text for hint in hints):
            categories.update(cats)
    return frozenset(categories)


def _tool_matches(meta: ToolMeta, categories: frozenset[str], explicit_names: set[str]) -> bool:
    if meta.name in explicit_names:
        return True
    if not categories:
        return False
    defn = get_tool(meta.name)
    if not defn or not defn.categories:
        return False
    return bool(defn.categories & categories)


def select_tools_for_chat(request: ChatRequest, ctx: ToolContext) -> list[ToolMeta]:
    """Return RBAC-filtered tools relevant to the chat request (capped)."""
    all_metas = list_tools(ctx)
    explicit_names: set[str] = set()
    if not request.project_id:
        explicit_names.update(_CORE_TOOLS_NO_PROJECT)

    categories = _wanted_categories(request)
    selected: list[ToolMeta] = []
    seen: set[str] = set()

    def _add(meta: ToolMeta) -> None:
        if meta.name in seen:
            return
        seen.add(meta.name)
        selected.append(meta)

    for meta in all_metas:
        if _tool_matches(meta, categories, explicit_names):
            _add(meta)

    if len(selected) < _MIN_ROUTED_TOOLS:
        for name in _FALLBACK_WITH_PROJECT if request.project_id else ("list_projects", "get_me"):
            defn = get_tool(name)
            if not defn:
                continue
            meta = next((m for m in all_metas if m.name == name), None)
            if meta:
                _add(meta)

    priority = {name: index for index, name in enumerate(_PRIORITY_READ_TOOLS)}
    selected.sort(key=lambda meta: (priority.get(meta.name, 999), meta.name))

    cap = settings.ASSISTANT_CHAT_MAX_ROUTED_TOOLS
    return selected[:cap]
