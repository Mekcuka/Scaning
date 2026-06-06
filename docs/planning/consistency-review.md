# Ревизия согласованности документации

Дата: май 2026. Проверка комплекта `docs/`.

## Итог

| Категория | Статус |
|-----------|--------|
| Док ↔ код (сводка) | [implementation-status.md](implementation-status.md) |
| SOLID / границы модулей | [solid-refactoring-plan.md](solid-refactoring-plan.md), [module-boundaries.md](../architecture/module-boundaries.md) (фаза 0, июнь 2026) |
| Навигация (Параметры, Потоки, ставки внутри Параметров) | Согласовано (май 2026) |
| OpenLayers / Lucide | Согласовано |
| Импорт отдельно от карты | Согласовано |
| 16 ставок, тыс. ₽ | Согласовано |
| 9 подтипов vs анализ на карте | Согласовано |
| Internal linear = pads × km/КП | **Зафиксировано** (FR-5.3.4, calculation-functions §3) |
| Каталог расчётных функций | **Добавлен** [calculation-functions.md](../calculations/calculation-functions.md) |
| `decision_matrices` | **Legacy** (FR-14.1.3) |
| Backend-стек | **FastAPI** (README, architecture, development-plan) |
| Пороги external (4) + internal length (4) + км/КП (4) | **mvp** в input-parameters |
| Публикация проекта (Viewer) | FR-1.2.6, `projects.visibility` |
| Admin, audit, import credentials | FR-1.4, FR-1.3.3, FR-2.5.9–10 |

## Карта соответствия разделов и FR

| § в requirements.md | Тема | Префикс FR |
|----------------------|------|------------|
| 1 | Пользователи, Admin | FR-1 |
| 2 | Карта, слои, импорт | FR-2 |
| 4 | Проекты, POI, ставки | FR-4 |
| 5 | Инженерные параметры, км/КП | FR-5 |
| 6 | Анализ окружения | FR-6 |
| 7 | Варианты и стоимость | FR-7 |
| 8 | Инфраструктурная матрица | FR-8 |
| 10 | Визуализация на карте | FR-10 |
| 11 | Одностраничник | FR-11 |
| 12 | UI, навигация, таблицы | FR-12 |
| 13 | Системные (SR) | SR-13 |
| 14 | Вне scope MVP | — |

## Ревизия: закрытие пробелов документации (май 2026)

### Сделано

1. **[calculation-functions.md](../calculations/calculation-functions.md)** — каталог формул, pipeline, internal/external ветки.
2. **Внутренние линейные:** `distance_km = pads_count × km_per_pad(subtype)`; колонки в `project_distance_defaults` и POI; `distance_source` в `poi_infrastructure_analysis`.
3. **FR обновлены:** FR-5.3.4, FR-6.1–6.3.5, FR-7.1.1, FR-7.3.1, FR-10.3.1, FR-1.2.6, FR-1.4, FR-2.5.9–10, FR-11.1.3–11.2.4, §14 post-MVP.
4. **[input-parameters.md](../product/input-parameters.md):** `threshold_*`, `km_per_pad_*` → mvp; `project_visibility`.
5. **[database-schema.md](../architecture/database-schema.md):** `import_connections`, `audit_log`, `visibility`, legacy note на `decision_matrices`.
6. **[architecture.md](../architecture/architecture.md):** FastAPI, candidates API.
7. **[user-flows.md](../product/user-flows.md), [development-plan.md](development-plan.md), [map-objects-and-spatial-calculations.md](../features/map-objects-and-spatial-calculations.md), [calculation-logic-flow.md](../calculations/calculation-logic-flow.md)** — синхронизированы.

## Ревизия: продуктовые решения P0 (май 2026)

| Решение | Где зафиксировано |
|---------|-------------------|
| Internal: `pads × km_per_pad` vs **`max_total_line_*_km`** | FR-4.1.5, FR-6.2.1b, calculation-functions §4.2, input-parameters §1.5/§2.6 |
| External: geodesic vs **`max_distance_*`** (4 Point) | FR-4.1.5, FR-6.2.1a; `max_distance_autoroad`…`power` — только карта (FR-10.2) |

### P1 (допущения MVP, §14.1)

| Тема | Решение |
|------|---------|
| `pads_count = 0` | FR-6.2.1b, FR-14.1.4 |
| Подтверждение email | Не MVP (FR-14.1.1); user-flows §1 |
| Legacy `decision_matrices` | Не удалять (FR-14.1.3) |
| Seed `criteria` | Legacy для универсальных матриц (FR-14.1.5) |

## Ревизия: согласование с кодом приложения (май 2026)

| Решение | Где зафиксировано |
|---------|-------------------|
| Единый статус реализации | [implementation-status.md](implementation-status.md) |
| Меню UI: Параметры вместо отдельных «Ставки»; `/flows`, `/import` | implementation-status, FR-12.2.2 (примечание) |
| 2D basemap: Esri satellite; OSM 2D — gap | implementation-status, FR-2.1.2 |
| Async import без Celery | implementation-status, development-plan неделя 4 |
| Расширенные подтипы карты vs 9 строк матрицы | map-objects §1.4, implementation-status |
| 3D, PFD, песок, Искра — реализовано | map-3d-features, fluid-flow-schematic, spark-import-mapping |
| Custom GLB, assign-by-subtype, layer prefs, cross-origin Bearer | map-3d-features § custom GLB, §12; auth-rbac § cross-origin; user-flows §2.2; DEPLOY § custom GLB |
| PDF = client print; PPTX = server | decision-matrix/README, implementation-status |
| TOPSIS / decision_matrices — удалено из UI | § «Удаление ранжирования» ниже |

## Ревизия: схема потоков PFD (май 2026)

| Решение | Где зафиксировано |
|---------|-------------------|
| Вкладка «Потоки» `/flows`, React Flow + API flow-schematic | [fluid-flow-schematic.md](../features/fluid-flow-schematic.md) §9, user-flows §3.9 |
| Ветка «Вода» всегда для `fluid_type = oil` | fluid-flow-schematic §3.1, `active_fluids` |
| Локальная закачка → «В пласт»; централизованная → БКНС → «В пласт» | fluid-flow-schematic §3.3, map-objects §1.6 |
| `water_injection_volume` POI — popover блока «В пласт» | fluid-flow-schematic §3.3, input-parameters `poi_water_injection_volume` |
| Пропускная способность на карте (`properties`) + PFD | map-objects §1.6, input-parameters `infra_throughput_*` |
| Слияние layout с расчётной топологией | fluid-flow-schematic §6, `flow_schematic_merge.py` |
| PFD vs анализ: разные правила активации водопровода | fluid-flow-schematic §3.3 (примечание) |

### Чеклист: добавление нового параметра

1. Заполнить заявку (шаблон в [input-parameters.md](../product/input-parameters.md) §10).
2. Добавить строку в каталог (статус `candidate` → после согласования `mvp`).
3. Обновить [requirements.md](../product/requirements.md) — FR-x.y.z.
4. Обновить [user-flows.md](../product/user-flows.md) — шаг UI.
5. При влиянии на расчёт — [calculation-functions.md](../calculations/calculation-functions.md) и [calculation-logic-flow.md](../calculations/calculation-logic-flow.md).
6. [database-schema.md](../architecture/database-schema.md) — колонка или JSONB.
7. Запись в этот файл (раздел «Ревизия»).

### Ожидает дальнейших полей

Раздел **§10** input-parameters.md — шаблон для следующих заявок.

## Исправленные расхождения (ранее)

### 1. Дублирование FR-9.x (карта vs отчёт)

Раздел 10 (карта) переведён на **FR-10.x**, отчёт — **FR-11.x**, UI — **FR-12.x**.

### 2. «17 ставок»

Исправлено на **16 показателей** (4+4+1+7 инженерных ставок подготовки).

### 3. Пороги и UI

Ранее `planned` в каталоге при наличии FR — устранено: **mvp** + экраны в user-flows.

### 4. Две модели матрицы

`decision_matrices` — legacy; MVP использует `implementation_variants` + инфраструктурную матрицу (FR-8).

## Ревизия: удаление ранжирования (май 2026)

Функционал TOPSIS/WSM/AHP и раздел «Ранжирование» **удалены** из приложения `decision-matrix/` и основной документации.

## Оставшиеся осознанные отличия

| Тема | Документация prod | Прототип (не в scope) |
|------|-------------------|------------------------|
| Internal km formula | FR-5.3.4 | Статический distance в mock |
| Пороги 4+4 / км/КП в форме | mvp в docs | Planned в alignment |
| `max_total_line_*` vs geodesic internal | P0 в docs | mock static distance |
| FastAPI backend | README | HTML only |
| Ранжирование TOPSIS | Удалено из prod | — |

## Рекомендации на будущее

1. Новые FR — после строки в [input-parameters.md](../product/input-parameters.md).
2. Candidate-поля — JSONB, затем колонки при стабилизации.
3. Post-MVP — только через §14 requirements или v1.x в development-plan.
