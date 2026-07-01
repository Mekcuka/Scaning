"""Russian labels for project background jobs (mirror frontend jobLabels.ts)."""

from __future__ import annotations

JOB_TYPE_LABELS: dict[str, str] = {
    "sand_logistics_analyze": "Логистика песка",
    "poi_analyze_all": "Анализ окружения",
    "autoroad_connect": "Автодороги / сеть",
    "import_file": "Импорт файла",
    "pad_earthwork_compute": "Земляные работы куста",
    "well_trajectory_compute": "Anti-collision (SF)",
    "well_trajectory_import": "Импорт инклинометрии",
    "pad_placement_compute": "Оптимизация кустов",
    "pad_placement_apply": "Применение кустов",
    "line_elevation_profile_compute": "Профиль высот линий",
}

JOB_STATUS_LABELS: dict[str, str] = {
    "pending": "В очереди",
    "running": "Выполняется",
    "completed": "Завершена",
    "failed": "Ошибка",
    "cancelled": "Отменена",
}


def job_type_label_ru(job_type: str) -> str:
    return JOB_TYPE_LABELS.get(job_type, job_type)


def job_status_label_ru(status: str) -> str:
    return JOB_STATUS_LABELS.get(status, status)
