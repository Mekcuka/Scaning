"""Каталог задач проекта Scaning для экспорта в Kaiten."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from kaiten.feature_phase import list_pipeline_features

ColumnKey = Literal["queue", "in_progress", "done"]

REPO_GITHUB = "https://github.com/Mekcuka/Scaning"


@dataclass(frozen=True)
class ProjectTask:
    task_id: str
    title: str
    column_key: ColumnKey
    category: str
    source: str
    notes: str = ""


def _static_tasks() -> list[ProjectTask]:
    return [
        # --- Конвейер (детализация подзадач) ---
        ProjectTask(
            "ws-push-ci",
            "WebSocket journal: push + CI + деплой",
            "in_progress",
            "Jobs",
            "docs/features/websocket-journal/integration-log.md",
            "Локально готово; ждёт push и green CI",
        ),
        ProjectTask(
            "ws-e2e-analyze",
            "WebSocket: E2E analyze → TaskLogPanel",
            "queue",
            "Quality",
            "docs/features/websocket-journal/integration-log.md",
        ),
        ProjectTask(
            "ws-cancel-job",
            "WebSocket: отмена job через WS",
            "queue",
            "Jobs",
            "docs/features/websocket-journal/review-report.md",
        ),
        ProjectTask(
            "map3d-deploy",
            "3D-карта: Integrator CI + деплой",
            "in_progress",
            "Map",
            "docs/features/map3d-performance/review-report.md",
            "Review ЗЕЛЁНЫЙ",
        ),
        ProjectTask(
            "map3d-worker-tubes",
            "3D-карта: worker для геометрии труб",
            "queue",
            "Map",
            "docs/features/map3d-performance/review-report.md",
        ),
        # --- MVP gaps ---
        ProjectTask(
            "fr-profile",
            "Профиль пользователя (FR-1.3.1)",
            "queue",
            "UX",
            "docs/planning/implementation-status.md",
        ),
        ProjectTask(
            "fr-audit-log",
            "Журнал действий audit_log (FR-1.3.3)",
            "queue",
            "Enterprise",
            "docs/planning/implementation-status.md",
        ),
        ProjectTask(
            "fr-email-confirm",
            "Подтверждение email (FR-14.1.1)",
            "queue",
            "Auth",
            "docs/planning/implementation-status.md",
        ),
        ProjectTask(
            "fr-onboarding",
            "Landing + onboarding-тур",
            "queue",
            "UX",
            "docs/planning/implementation-status.md",
        ),
        ProjectTask(
            "fr-network-node",
            "network_node в анализе POI (FR-2.4.5)",
            "queue",
            "Calculations",
            "docs/planning/implementation-status.md",
        ),
        ProjectTask(
            "fr-osm-2d",
            "OSM подложка в 2D (FR-2.1.2)",
            "queue",
            "Map",
            "docs/planning/implementation-status.md",
        ),
        ProjectTask(
            "fr-layer-dnd",
            "Drag-and-drop порядка слоёв (FR-2.2.4)",
            "queue",
            "Map",
            "docs/planning/implementation-status.md",
        ),
        ProjectTask(
            "fr-server-pdf",
            "Server-side PDF WeasyPrint (FR-11.2.1)",
            "queue",
            "Reports",
            "docs/planning/implementation-status.md",
        ),
        ProjectTask(
            "fr-excel-matrix",
            "Полный Excel экспорт матрицы/отчёта",
            "queue",
            "Reports",
            "docs/planning/implementation-status.md",
        ),
        ProjectTask(
            "fr-i18n",
            "i18n (сейчас только русский UI)",
            "queue",
            "UX",
            "docs/planning/implementation-status.md",
        ),
        # --- Assistant roadmap ---
        ProjectTask(
            "asst-7-3",
            "AI Assistant: fallback при переполнении контекста (7.3)",
            "queue",
            "Assistant",
            "docs/architecture/assistant.md",
        ),
        ProjectTask(
            "asst-7-4",
            "AI Assistant: расширенный /assistant/status (7.4)",
            "in_progress",
            "Assistant",
            "docs/architecture/assistant.md",
        ),
        # --- Well trajectory ---
        ProjectTask(
            "well-witsml",
            "Траектории: импорт WITSML (4b)",
            "queue",
            "Well trajectory",
            "docs/features/well-trajectory/well-trajectory-roadmap.md",
        ),
        ProjectTask(
            "well-settings",
            "Траектории: projects.settings.well_trajectory",
            "queue",
            "Well trajectory",
            "docs/features/well-trajectory/well-trajectory-app-assessment.md",
        ),
        ProjectTask(
            "well-recalc-prompt",
            "Траектории: prompt «Пересчитать?» при save sketch",
            "queue",
            "Well trajectory",
            "docs/features/well-trajectory/well-trajectory-implementation-plan.md",
        ),
        ProjectTask(
            "well-mcp-tools",
            "Траектории: MCP list_wells, well_clearance",
            "queue",
            "Assistant",
            "docs/features/well-trajectory/well-trajectory-roadmap.md",
        ),
        # --- Pad placement ---
        ProjectTask(
            "pad-dem",
            "Pad placement: DEM для отметки устья",
            "queue",
            "Pad placement",
            "docs/features/pad-placement/pad-placement-optimization.md",
        ),
        ProjectTask(
            "pad-forbidden",
            "Pad placement: запретные зоны / лицензия",
            "queue",
            "Pad placement",
            "docs/features/pad-placement/pad-placement-optimization.md",
        ),
        # --- Map 3D roadmap ---
        ProjectTask(
            "map3d-l2-props",
            "3D: per-object render_3d_* + UI в карточке",
            "queue",
            "Map",
            "docs/features/map/map-3d-plan.md",
        ),
        ProjectTask(
            "map3d-s3",
            "3D: object storage S3 для custom GLB",
            "queue",
            "Platform",
            "docs/features/map/map-3d-plan.md",
        ),
        ProjectTask(
            "map3d-report",
            "3D в матрице и отчёте",
            "queue",
            "Map",
            "docs/planning/system-evolution-plan.md H2.5",
        ),
        # --- Platform H0-H1 ---
        ProjectTask(
            "h0-backup-db",
            "Platform: бэкап PostgreSQL + runbook",
            "queue",
            "Platform",
            "docs/planning/system-evolution-plan.md H0.1",
        ),
        ProjectTask(
            "h0-smoke-prod",
            "Platform: prod smoke-suite после релиза",
            "queue",
            "Platform",
            "docs/planning/system-evolution-plan.md H0.2",
        ),
        ProjectTask(
            "h0-logs-alerts",
            "Platform: централизованные логи + алерты uptime",
            "queue",
            "Platform",
            "docs/planning/system-evolution-plan.md H0.3-H0.4",
        ),
        ProjectTask(
            "h0-runbook",
            "Platform: runbook инцидентов (откат, 502)",
            "queue",
            "Platform",
            "docs/planning/system-evolution-plan.md H0.6",
        ),
        ProjectTask(
            "h1-load-map",
            "Quality: нагрузочный тест карты 1000+ объектов",
            "queue",
            "Quality",
            "docs/planning/system-evolution-plan.md H1.1",
        ),
        ProjectTask(
            "h1-bench-matrix",
            "Quality: бенчмарк матрицы 20×50 < 5с",
            "queue",
            "Quality",
            "docs/planning/system-evolution-plan.md H1.2",
        ),
        ProjectTask(
            "h1-coverage-gates",
            "Quality: coverage gates в CI",
            "queue",
            "Quality",
            "docs/planning/system-evolution-plan.md H1.6",
        ),
        ProjectTask(
            "h1-husky",
            "DevEx: Husky + lint-staged в корне",
            "queue",
            "DevEx",
            "docs/planning/development-plan.md",
        ),
        # --- H2-H5 ---
        ProjectTask(
            "h2-sharing",
            "Sharing проектов / invite коллег",
            "queue",
            "Collaboration",
            "docs/planning/system-evolution-plan.md H2.3",
        ),
        ProjectTask(
            "h3-celery-import",
            "Celery + Redis для фонового import sync",
            "queue",
            "Integrations",
            "docs/planning/system-evolution-plan.md H3.4",
        ),
        ProjectTask(
            "h3-managed-pg",
            "Managed PostgreSQL (YC MDB)",
            "queue",
            "Platform",
            "docs/planning/system-evolution-plan.md H3.7",
        ),
        ProjectTask(
            "h5-sso",
            "SSO / LDAP / Keycloak",
            "queue",
            "Enterprise",
            "docs/planning/system-evolution-plan.md H5.1",
        ),
        ProjectTask(
            "h5-multitenant",
            "Multi-tenant / изоляция организаций",
            "queue",
            "Enterprise",
            "docs/planning/system-evolution-plan.md H5.3",
        ),
        # --- Готово (крупные модули) ---
        ProjectTask(
            "done-auth",
            "Auth + RBAC + JWT",
            "done",
            "Core",
            "docs/planning/implementation-status.md",
        ),
        ProjectTask(
            "done-map-2d",
            "Карта 2D: слои, объекты, импорт, анализ",
            "done",
            "Map",
            "docs/planning/implementation-status.md",
        ),
        ProjectTask(
            "done-map-3d-view",
            "3D-карта view-only + custom GLB",
            "done",
            "Map",
            "docs/features/map/map-3d-features.md",
        ),
        ProjectTask(
            "done-pad-earthwork",
            "Земляные работы куста (DEM, 3D, footprints)",
            "done",
            "Pad earthwork",
            "docs/features/pad-earthwork/pad-earthwork.md",
        ),
        ProjectTask(
            "done-well-m1-m4a",
            "Траектории M1–M4a (BFF, Кустование, CSV/.wbp)",
            "done",
            "Well trajectory",
            "docs/features/well-trajectory/well-trajectory-roadmap.md",
        ),
        ProjectTask(
            "done-pad-placement",
            "Оптимизация размещения кустов M1–M5",
            "done",
            "Pad placement",
            "docs/features/pad-placement/pad-placement-optimization-plan.md",
        ),
        ProjectTask(
            "done-autoroad",
            "Автосеть автодорог (Steiner, UI «Сеть»)",
            "done",
            "Map",
            "docs/planning/implementation-status.md",
        ),
        ProjectTask(
            "done-flows",
            "PFD + экономика потоков",
            "done",
            "Flows",
            "docs/features/flows/",
        ),
        ProjectTask(
            "done-sand",
            "Песок / логистика",
            "done",
            "Sand",
            "docs/planning/implementation-status.md",
        ),
        ProjectTask(
            "done-import-export",
            "Импорт Искра + /data/import + /data/export",
            "done",
            "Import",
            "docs/features/import-export/",
        ),
        ProjectTask(
            "done-matrix",
            "Матрица решений + 9 строк анализа",
            "done",
            "Matrix",
            "docs/planning/implementation-status.md",
        ),
        ProjectTask(
            "done-reports",
            "Отчёты one-pager + PPTX",
            "done",
            "Reports",
            "docs/planning/implementation-status.md",
        ),
        ProjectTask(
            "done-assistant-core",
            "AI Assistant фазы 1–10 (tools, MCP, wiki)",
            "done",
            "Assistant",
            "docs/features/assistant/assistant-tools.md",
        ),
        ProjectTask(
            "done-admin-jobs",
            "Журнал задач + /admin/jobs",
            "done",
            "Jobs",
            "docs/features/jobs/task-log-panel.md",
        ),
        ProjectTask(
            "done-ws-code",
            "WebSocket journal (код + review green)",
            "done",
            "Jobs",
            "docs/features/websocket-journal/",
        ),
    ]


def collect_all_tasks(features_root, repo_root) -> list[ProjectTask]:
    """Все задачи: статический каталог + фичи конвейера (если ещё не в списке)."""
    tasks = list(_static_tasks())
    seen = {t.task_id for t in tasks}

    for phase in list_pipeline_features(features_root, repo_root):
        tid = f"pipeline-{phase.feature_id}"
        if tid in seen:
            continue
        if phase.role == "Done":
            col: ColumnKey = "done"
        elif phase.role == "Planner":
            col = "queue"
        else:
            col = "in_progress"
        tasks.append(
            ProjectTask(
                tid,
                phase.name,
                col,
                "Pipeline",
                phase.doc_path,
                f"{phase.role}: {phase.phase}",
            )
        )
        seen.add(tid)

    return tasks


def card_title(prefix: str, task: ProjectTask) -> str:
    short = task.title if len(task.title) <= 72 else task.title[:69] + "..."
    return f"{prefix} {short}"


def card_description(task: ProjectTask) -> str:
    lines = [
        f"**Категория:** {task.category}",
        f"**Статус Scaning:** {task.column_key}",
        f"**Источник:** `{task.source}`",
        f"**Репозиторий:** {REPO_GITHUB}",
    ]
    if task.notes:
        lines.append(f"**Заметки:** {task.notes}")
    return "\n".join(lines)
