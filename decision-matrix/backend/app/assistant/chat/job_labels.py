"""Russian labels for project background jobs (mirror frontend jobLabels.ts)."""

from __future__ import annotations

JOB_TYPE_LABELS: dict[str, str] = {
    "sand_logistics_analyze": "Логистика песка",
    "poi_analyze_all": "Анализ окружения",
    "autoroad_connect": "Автодороги / сеть",
    "import_file": "Импорт файла",
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
