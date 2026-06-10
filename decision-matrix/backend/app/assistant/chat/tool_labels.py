"""Russian labels for assistant tools (chat UI and pending confirm)."""

from __future__ import annotations

TOOL_LABELS_RU: dict[str, str] = {
    "get_me": "Текущий пользователь",
    "get_assistant_status": "Статус AI-помощника",
    "get_autoroad_solver_status": "Статус расчёта автодорог",
    "list_projects": "Список проектов",
    "create_project": "Создать проект",
    "create_poi": "Создать POI",
    "get_project": "Данные проекта",
    "get_distance_defaults": "Пороги расстояний проекта",
    "list_pois": "Список POI",
    "get_poi": "Карточка POI (инженерные решения)",
    "list_infra_layers": "Слои карты",
    "list_infra_objects": "Объекты инфраструктуры",
    "update_infra_object": "Изменить объект инфраструктуры",
    "get_poi_analysis": "Анализ POI",
    "get_poi_candidates": "Кандидаты инфраструктуры",
    "analyze_poi": "Анализ одного POI",
    "start_analyze_all_pois": "Запустить анализ всех POI",
    "update_cost_rates": "Обновить тарифы проекта",
    "batch_delete_map_objects": "Удалить объекты на карте",
    "admin_list_assistant_audit": "Журнал assistant (админ)",
    "get_project_job": "Статус фоновой задачи",
    "list_project_jobs": "Журнал задач проекта",
    "cancel_project_job": "Отменить фоновую задачу",
    "get_sand_logistics_result": "Результат логистики песка",
    "get_flow_schematic": "Схема потоков",
    "get_cost_rates": "Тарифы проекта",
    "get_economic_params": "Экономические параметры",
    "list_networks": "Графовые сети",
    "list_network_nodes": "Узлы сети",
    "list_network_edges": "Рёбра сети",
    "list_one_pagers": "One-pager отчёты",
    "get_one_pager": "One-pager отчёт",
    "list_import_logs": "Журнал импортов",
    "get_import_log": "Запись импорта",
    "list_import_connections": "Подключения импорта",
    "list_map3d_custom_models": "3D-модели карты",
    "admin_list_jobs": "Журнал задач (админ)",
    "admin_jobs_health": "Состояние очереди задач (админ)",
    "admin_list_users": "Пользователи (админ)",
    "admin_stats": "Статистика системы (админ)",
    "list_wiki_articles": "Справка: список статей",
    "search_wiki": "Поиск в справке",
    "get_wiki_article": "Статья справки",
}

PENDING_DESCRIPTIONS_RU: dict[str, str] = {
    "start_analyze_all_pois": "Запустить анализ всех POI в проекте? Это фоновая операция.",
    "cancel_project_job": "Отменить выбранную фоновую задачу в проекте?",
    "create_project": "Создать новый проект с указанным именем?",
    "create_poi": "Создать новую точку интереса (POI) в проекте?",
    "update_infra_object": "Изменить метаданные объекта инфраструктуры на карте?",
    "analyze_poi": "Запустить анализ инфраструктуры для выбранного POI?",
    "update_cost_rates": "Обновить тарифы (cost rates) проекта?",
    "batch_delete_map_objects": "Удалить указанные объекты инфраструктуры и/или POI с карты?",
}


def tool_label_ru(name: str) -> str:
    return TOOL_LABELS_RU.get(name, name)


def humanize_tool_names_in_text(content: str) -> str:
    """Replace snake_case tool ids in assistant text with Russian labels."""
    if not content:
        return content
    out = content
    for name in sorted(TOOL_LABELS_RU, key=len, reverse=True):
        label = TOOL_LABELS_RU[name]
        out = out.replace(f"`{name}`", label)
        out = out.replace(name, label)
    return out


def pending_description_ru(tool: str, fallback: str) -> str:
    return PENDING_DESCRIPTIONS_RU.get(tool, fallback)
