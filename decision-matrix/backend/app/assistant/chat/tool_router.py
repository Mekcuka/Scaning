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
    CAT_HELP,
    CAT_JOBS,
    CAT_MAP,
    CAT_PROJECTS,
    CAT_RATES,
    CAT_SESSION,
)
from app.core.config import settings

_CORE_TOOLS_NO_PROJECT = frozenset({"list_projects", "get_me"})
_CORE_WIKI_TOOLS = frozenset({"list_wiki_articles", "search_wiki", "get_wiki_article"})
_FALLBACK_WITH_PROJECT = ("list_projects", "get_project", "list_infra_objects")
_MIN_ROUTED_TOOLS = 3

_PRIORITY_READ_TOOLS: tuple[str, ...] = (
    "list_projects",
    "get_me",
    "get_project",
    "list_infra_objects",
    "list_pois",
    "get_poi",
    "get_cost_rates",
    "get_economic_params",
    "get_project_job",
    "list_project_jobs",
    "get_poi_analysis",
    "get_poi_candidates",
    "list_infra_layers",
    "get_flow_schematic",
    "get_economic_flow",
    "get_sand_logistics_result",
    "admin_list_jobs",
    "admin_jobs_health",
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
    (
        ("анализ", "кандидат", "матриц", "превыш", "стоимост"),
        frozenset({CAT_ANALYSIS}),
    ),
    (
        ("электроснабжен", "инженерн", "ппд", "внешн", "внутренн", "мкос", "транспорт"),
        frozenset({CAT_PROJECTS, CAT_ANALYSIS}),
    ),
    (("поток", "схем", "логистик", "песок", "sand", "pfd"), frozenset({CAT_FLOW})),
    (("импорт", "import"), frozenset({CAT_PROJECTS})),
    (("сеть", "network", "автодорог"), frozenset({CAT_MAP, CAT_ANALYSIS})),
    (("admin", "админ", "пользовател"), frozenset({CAT_ADMIN})),
    (("статус", "solver"), frozenset({CAT_SESSION, CAT_JOBS})),
    (
        (
            "как",
            "где",
            "помощь",
            "инструкц",
            "wiki",
            "справк",
            "что такое",
            "зачем",
            "импортировать",
            "зарегистрир",
            "роль",
            "доступ",
            "навигац",
            "раздел",
        ),
        frozenset({CAT_HELP}),
    ),
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
    explicit_names.update(_CORE_WIKI_TOOLS)

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
    must_have = [m for m in selected if m.name in explicit_names]
    optional = [m for m in selected if m.name not in explicit_names]
    room = max(cap - len(must_have), 0)
    return must_have + optional[:room]
