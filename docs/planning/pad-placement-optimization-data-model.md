# Модель данных: оптимизация размещения кустов

> **Статус:** ✅ реализовано (v1, M1–M5 + M2+ center optimize, июнь 2026).  
> **Спецификация:** [pad-placement-optimization.md](../features/pad-placement-optimization.md).

Описание JSON-структур для API, фоновых задач и предпросмотра на карте. Соответствует реализованному BFF `pad_placement`.

Имена полей в JSON **на английском** — так же, как в коде; пояснения — на русском.

---

## 1. Запрос на расчёт (данные с карты)

### `PadPlacementComputeRequest`

| Поле | Тип | Обяз. | Описание |
|------|-----|-------|----------|
| `bottomhole_ids` | `UUID[]` | да | Id выбранных забоев (ННБ, пятка ГС; сток подтягивается по `gs_heel_id`) |
| `params` | `PadPlacementParams` | да | Ограничения расчёта |
| `subtype` | `"oil_pad"` \| `"gas_pad"` | нет | Тип создаваемых кустов; по умолчанию `oil_pad` |

### `PadPlacementParams`

| Поле | Тип | По умолч. | Описание |
|------|-----|-----------|----------|
| `max_wells_per_pad` | int | 12 | Макс. скважин на одном кусте (ограничение C1) |
| `well_spacing_m` | number | 9 | Шаг между устьями → `pad_well_spacing_m` |
| `wells_per_group` | int | 1 | Скважин в группе → `pad_wells_per_group` |
| `group_spacing_m` | number | 9 | Шаг между группами → `pad_well_group_spacing_m` |
| `margin_left_m` | number | 27 | Отступы контура площадки |
| `margin_bottom_m` | number | 43 | |
| `margin_top_m` | number | 15 | |
| `margin_end_m` | number | 70 | |
| `rotation_deg` | number | 90 | Азимут оси куста (НДС) |
| `min_pad_spacing_m` | number | 200 | Мин. расстояние между новыми кустами и до существующих (C4) |
| `step_m` | number | 30 | Шаг инклинометрии при design |
| `sf_check` | boolean | false | Учитывать SF при оценке (фаза M5) |
| `sf_threshold` | number | 1.0 | Порог SF |
| `top_k` | int | 5 | Сколько лучших вариантов вернуть |
| `center_optimize` | boolean | true | Перебор центра куста по минимальной Σ MD |
| `center_search_radius_m` | number | 400 | Радиус окна поиска центра, м |
| `center_search_step_m` | number | 200 | Шаг сетки перебора, м |
| `gs_entry_search_step_m` | number \| null | null | Явный шаг перебора точки входа ГС при `gs_entry_mode=any`; `null` — адаптивный (см. §4) |

**Внутренние режимы design** (не в POST body): `trajectory_design` в `evaluate_pad_group` — `coarse` (сетка центра, фаза 1), `full` (финальный design), `skip` (не используется в v1).

### `BottomholeSnapshot` (внутренний, после чтения из БД)

```json
{
  "id": "uuid",
  "subtype": "well_bottomhole_nnb",
  "name": "Забой-1",
  "longitude": 50.123,
  "latitude": 55.456,
  "properties": {
    "well_bottomhole_tvd_m": 2500,
    "well_bottomhole_target_inc": 360,
    "well_bottomhole_target_azi": 90,
    "well_bottomhole_well_index": null,
    "well_bottomhole_linked_pad_id": null,
    "well_bottomhole_gs_heel_id": null
  }
}
```

---

## 2. Логическая скважина

### `LogicalWell`

| Поле | Тип | Описание |
|------|-----|----------|
| `logical_id` | string | Стабильный id в рамках запроса (`"nnb:{uuid}"` или `"gs:{heel_uuid}"`) |
| `profile` | `"nnb"` \| `"gs"` | Профиль бурения |
| `bottomhole_ids` | UUID[] | 1 id для ННБ; 2 для ГС (пятка, сток) |
| `td_longitude` | number | Долгота TD (для ГС — сток, для ННБ — точка забоя) |
| `td_latitude` | number | Широта TD |
| `tvd_m` | number | Глубина по вертикали, м |
| `target_inc` | number | Целевой угол наклона (необяз.) |
| `target_azi` | number | Целевой азимут (необяз.) |
| `heel_longitude` | number | Только ГС — пятка |
| `heel_latitude` | number | Только ГС — пятка |

**Правило:** `N = len(logical_wells)` — именно это число участвует в кластеризации и в лимите «скважин на куст».

---

## 3. Промежуточные структуры (только в памяти)

### `PadCandidate` — один куст в варианте

| Поле | Тип | Описание |
|------|-----|----------|
| `candidate_id` | string | `"v{variant}_p{index}"` |
| `center_longitude` | number | Долгота центра куста |
| `center_latitude` | number | Широта центра |
| `assigned_logical_ids` | string[] | Какие логические скважины на этом кусте |
| `sketch` | PlanShapeSketch | Контур площадки от генератора |
| `wells_local` | `{east_m, north_m}[]` | Устья в локальных координатах |
| `length_m`, `width_m` | number | Габариты площадки |
| `rotation_deg` | number | Поворот |
| `trajectories` | WellTrajectory[] | Траектории после design |
| `warnings` | string[] | Предупреждения по этому кусту |

### `PlacementVariant` — один полный вариант

| Поле | Тип | Описание |
|------|-----|----------|
| `variant_index` | int | Порядковый номер после сортировки (с 0) |
| `pad_count` | int | Число кустов |
| `sum_md_m` | number | Сумма MD по скважинам (последняя station) |
| `pads` | PadCandidate[] | Список кустов |
| `score_warnings` | string[] | Пропуски design, SF, расстояния |
| `invalid` | boolean | true — жёсткое ограничение нарушено |
| `min_sf` | number \| null | Худшая пара SF в варианте (M5) |

---

## 4. Ответ расчёта

### `PadPlacementComputeResponse`

| Поле | Тип | Описание |
|------|-----|----------|
| `request_id` | UUID | Id сессии расчёта (кэш / задача) |
| `logical_well_count` | int | N скважин |
| `partitions_evaluated` | int | Сколько разбиений проверено |
| `variants` | PlacementVariant[] | Лучшие top-K |
| `warnings` | string[] | Общие предупреждения |
| `computed_at` | ISO datetime | Время расчёта |

Ответ при фоновой задаче (HTTP 202):

```json
{
  "job_id": "uuid",
  "job_type": "pad_placement_compute",
  "status": "queued"
}
```

---

## 5. GeoJSON для предпросмотра

### `GET .../preview/{request_id}/{variant_index}/geojson`

Типы объектов (поле `properties.kind`):

| kind | Геометрия | Что рисуем |
|------|-----------|------------|
| `pad_footprint_preview` | Polygon | Контур кандидата куста |
| `wellhead_preview` | Point | Устья |
| `trajectory_plan_preview` | LineString | Траектория в плане |
| `bottomhole_td_preview` | Point | Точки TD (забои) |

До «Применить» эти объекты **не создаются** в `InfrastructureObject`.

---

## 6. Применение варианта

### `PadPlacementApplyRequest`

| Поле | Тип | Описание |
|------|-----|----------|
| `request_id` | UUID | Id расчёта |
| `variant_index` | int | Какой вариант из списка записать |

### `PadPlacementApplyResponse`

| Поле | Тип | Описание |
|------|-----|----------|
| `created_pad_ids` | UUID[] | Id новых кустов (порядок = порядок в варианте) |
| `updated_bottomhole_ids` | UUID[] | Id обновлённых забоев |
| `warnings` | string[] | Предупреждения |
| `applied_at` | ISO datetime | Время применения |

### Минимальный набор свойств нового куста

| Ключ | Откуда |
|-----|--------|
| `pad_wells_local_json` | `PadCandidate.wells_local` |
| `pad_earthwork_sketch_json` | `PadCandidate.sketch` |
| `pad_length_m`, `pad_width_m`, `pad_rotation_deg` | генератор |
| `pad_well_count` | число устьев |
| `pad_wells_trajectories_json` | `PadCandidate.trajectories` |
| `well_trajectory_computed_at` | время apply |
| отступы и шаги | из `PadPlacementParams` |

### Обновление забоев

| Ключ | Значение |
|-----|----------|
| `well_bottomhole_linked_pad_id` | id нового куста |
| `well_bottomhole_well_index` | номер скважины на кусте (0 … n−1) |

**Greenfield:** apply **не изменяет** существующие кусты — только создаёт новые и обновляет забои из исходного выбора.

---

## 7. Payload фоновой задачи (`project_jobs.payload`)

```json
{
  "request_id": "uuid",
  "project_id": "uuid",
  "user_id": "uuid",
  "compute_request": { "...PadPlacementComputeRequest..." }
}
```

Результат в `result_json`: `PadPlacementComputeResponse`.

Кэш предпросмотра по `request_id` — 24 ч (настраивается); после apply кэш можно сбросить.

---

## 8. Что намеренно не сохраняем до «Применить»

| Данные | Где не храним |
|--------|---------------|
| Контуры вариантов | Не в properties существующих кустов |
| Траектории-кандидаты | Не в общем JSON проекта |
| Промежуточные разбиения | Не в audit log (опционально в admin journal с M4) |

---

## 9. Соответствие параметров расчёта и свойств куста

| Параметр в запросе | Ключ на кусте после apply |
|--------------------|---------------------------|
| `max_wells_per_pad` | `pad_well_count` |
| `well_spacing_m` | `pad_well_spacing_m` |
| `step_m` | `well_trajectory_step_m` |
| `sf_threshold` | `well_trajectory_sf_warning_threshold` |

Defaults на уровне проекта (`projects.settings.pad_placement`) — после M2; в v1 всё передаётся в теле запроса.

---

## 10. Адаптивный шаг перебора точки входа ГС

При `gs_entry_search_step_m: null` и `gs_entry_mode: any` backend вычисляет шаг по длине горизонтали (пятка→сток в plan ENU):

| Режим `trajectory_design` | Формула (минимум 50 м) |
|---------------------------|-------------------------|
| `coarse` (фаза 1 сетки центра) | `max(well_trajectory_gs_entry_search_step_m, length / 4)` |
| `full` (финальный design) | `max(well_trajectory_gs_entry_search_step_m, length / 10)` |

Явное значение `gs_entry_search_step_m` в `PadPlacementParams` переопределяет адаптивный расчёт.

---

## История изменений

| Дата | Изменение |
|------|-----------|
| 2026-06 | v1: первая модель данных |
| 2026-06 | v1.1: пояснения на понятном русском |
| 2026-06 | v1.2: `center_optimize`, `center_search_radius_m`, `center_search_step_m`; статус ✅ |
| 2026-06 | v1.3: `gs_entry_search_step_m`, `trajectory_design` coarse/full; сетка центра до 5×5 |
