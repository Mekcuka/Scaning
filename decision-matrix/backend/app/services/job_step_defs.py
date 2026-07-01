"""Step sequences per job_type — shared by worker instrumentation."""

from app.services.project_jobs import (
    JOB_TYPE_AUTOROAD_CONNECT,
    JOB_TYPE_IMPORT_FILE,
    JOB_TYPE_LINE_ELEVATION_PROFILE_COMPUTE,
    JOB_TYPE_PAD_EARTHWORK_COMPUTE,
    JOB_TYPE_PAD_PLACEMENT_APPLY,
    JOB_TYPE_PAD_PLACEMENT_COMPUTE,
    JOB_TYPE_POI_ANALYZE_ALL,
    JOB_TYPE_SAND_LOGISTICS_ANALYZE,
    JOB_TYPE_WELL_TRAJECTORY_COMPUTE,
    JOB_TYPE_WELL_TRAJECTORY_IMPORT,
)

# Keep in sync with docs/features/websocket-journal/plan.md
JOB_STEPS: dict[str, list[tuple[str, str]]] = {
    JOB_TYPE_AUTOROAD_CONNECT: [
        ("fetch_objects", "Загрузка объектов сети"),
        ("build_plan", "Построение плана автодорог"),
        ("apply_plan", "Применение плана к проекту"),
    ],
    JOB_TYPE_IMPORT_FILE: [
        ("read_file", "Чтение файла импорта"),
        ("validate", "Валидация данных"),
        ("import_records", "Импорт записей"),
        ("build_connections", "Построение связей"),
    ],
    JOB_TYPE_SAND_LOGISTICS_ANALYZE: [
        ("fetch_network", "Загрузка сети логистики"),
        ("build_subnets", "Построение подсетей"),
        ("solve_timeline", "Расчёт таймлайна"),
        ("persist_results", "Сохранение результатов"),
    ],
    JOB_TYPE_POI_ANALYZE_ALL: [
        ("fetch_pois", "Загрузка точек интереса"),
        ("analyze_per_poi", "Анализ каждой POI"),
        ("persist_results", "Сохранение результатов"),
    ],
    JOB_TYPE_PAD_EARTHWORK_COMPUTE: [
        ("fetch_dem", "Загрузка цифровой модели рельефа"),
        ("compute_volumes", "Расчёт объёмов земляных работ"),
        ("build_mesh", "Построение 3D-сетки"),
        ("persist_properties", "Сохранение в свойства объекта"),
    ],
    JOB_TYPE_WELL_TRAJECTORY_COMPUTE: [
        ("fetch_wells", "Загрузка устьев скважин"),
        ("design_trajectories", "Проектирование траекторий"),
        ("clearance_check", "Проверка противостояния"),
        ("persist_json", "Сохранение в JSON куста"),
    ],
    JOB_TYPE_WELL_TRAJECTORY_IMPORT: [
        ("parse_file", "Разбор файла импорта"),
        ("validate_survey", "Валидация данных инклинометрии"),
        ("store_trajectories", "Сохранение траекторий"),
    ],
    JOB_TYPE_PAD_PLACEMENT_COMPUTE: [
        ("fetch_candidates", "Загрузка кандидатов площадок"),
        ("cluster", "Кластеризация"),
        ("optimize", "Оптимизация размещения"),
    ],
    JOB_TYPE_PAD_PLACEMENT_APPLY: [
        ("load_variant", "Загрузка варианта"),
        ("apply_objects", "Применение к объектам проекта"),
    ],
    JOB_TYPE_LINE_ELEVATION_PROFILE_COMPUTE: [
        ("fetch_dem", "Загрузка цифровой модели рельефа"),
        ("sample_lines", "Сэмплинг профилей линий"),
        ("persist_properties", "Сохранение в свойства объектов"),
    ],
}
