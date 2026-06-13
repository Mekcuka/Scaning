# План реализации: оптимизация размещения кустов

> **Статус:** ✅ реализовано (M1–M5, июнь 2026).  
> **Спецификация:** [pad-placement-optimization.md](../features/pad-placement-optimization.md).  
> **Модель данных:** [pad-placement-optimization-data-model.md](pad-placement-optimization-data-model.md).

---

## Цель

С карты проекта: по выбранным забоям подобрать **минимум новых кустов** и **минимальную сумму MD**, показать варианты на карте и записать выбранный в базу.

---

## Этапы

| Этап | Название | Что делаем | Когда считаем готовым |
|------|----------|------------|------------------------|
| **D0** | Документация | Спецификация, модель данных, wiki, ссылки в `docs/` | Этот пакет документов |
| **M1** | Основа backend | Нормализация забоев в логические скважины; оценка вариантов на заглушках; тесты | pytest: 3 скважины, известное разбиение → ожидаемый порядок в рейтинге |
| **M2** | Ядро оптимизатора | Перебор числа кустов, кластеризация, эвристика центра, раскладка + design в памяти | API `compute` синхронно при N ≤ 6, топ-5 вариантов |
| **M3** | Интерфейс на карте | Выбор забоев, панель, таблица вариантов, слой GeoJSON | Вручную: 3 забоя → 2 варианта на карте |
| **M4** | Применение и задачи | `apply` создаёт кусты; перепривязка забоев; фон при N > 8; журнал задач | После apply объекты в БД; `/pad-clustering?padId=` открывается |
| **M5** | SF в оценке | Мягкие/жёсткие ограничения SF; сравнение в UI | ✅ pytest `test_pad_placement_sf`; колонка min SF |

---

## M1 — Основа backend ✅

- [x] `schemas.py`, `normalize.py`, `score.py`, `snapshot.py`
- [x] `tests/test_pad_placement_normalize.py`, `tests/test_pad_placement_score.py`
- [x] Роутер `api/v1/pad_placement.py`

---

## M2 — Оптимизатор и API расчёта ✅

- [x] `partition.py`, `placement.py`, `placement_optimize.py`, `evaluate.py`, `result_cache.py`, `compute.py`
- [x] M2+: перебор центра куста по Σ MD (`center_optimize`, сетка ±R)
- [x] `POST request`, `POST compute`, `GET compute/{request_id}`, `GET preview/.../geojson`
- [x] `tests/test_pad_placement_compute.py`, `test_pad_placement_placement.py`, `test_pad_placement_center_optimize.py`

---

## M3 — Frontend (карта) ✅

- [x] `padPlacementApi.ts`, `useMapPadPlacement.ts`, `PadPlacementPanel.tsx`
- [x] `drawMode: pad_placement`, кнопка «Кусты» на `/map`
- [x] `useMapViewPadPlacementSync.ts` — слой предпросмотра

---

## M4 — Применение и фоновые задачи ✅

- [x] `apply.py`, `POST /apply`
- [x] `JOB_TYPE_PAD_PLACEMENT_COMPUTE`, `JOB_TYPE_PAD_PLACEMENT_APPLY`
- [x] `tests/test_pad_placement_apply` (в `test_pad_placement_compute.py`)

---

## M5 — Учёт SF (anti-collision) ✅

- [x] `sf_score.py` — clearance при `sf_check`
- [x] Лексикографическое сравнение: `sf_violation_count`, `min_sf`
- [x] Колонка «min SF» в `PadPlacementPanel`
- [x] `tests/test_pad_placement_sf.py`

---

## D0 — Документация (текущий этап)

- [x] [pad-placement-optimization.md](../features/pad-placement-optimization.md)
- [x] [pad-placement-optimization-data-model.md](pad-placement-optimization-data-model.md)
- [x] [wiki/pad-placement-optimization.md](../wiki/articles/pad-placement-optimization.md)
- [x] Перекрёстные ссылки в well-trajectory, pad-earthwork, README, input-parameters и др.

---

## M1 — Основа backend

### Целевая структура файлов

```
decision-matrix/backend/app/
  api/v1/pad_placement.py          # маршруты BFF
  services/pad_placement/
    normalize.py                   # забои → логические скважины
    partition.py                   # разбиения на k групп
    placement.py                   # эвристики, spacing, td_centroid
    placement_optimize.py          # M2+ перебор центра по Σ MD
    evaluate.py                    # раскладка + design + оценка
    apply.py                       # запись варианта в БД
    schemas.py                     # модели Pydantic
    job_run.py                     # точка входа фоновой задачи
```

### Задачи

1. **`normalize_bottomholes(snapshot) → list[LogicalWell]`**
   - ННБ: одна точка = одна скважина.
   - ГС: группировка по `gs_heel_id`; сток подтягивается из snapshot.
   - Проверка TVD и координат.

2. **`score_variant(variant) → (pad_count, sum_md, warnings)`**
   - Сравнение вариантов по правилам из спецификации (Σ MD последней station).
   - При partial failure — fallback TVD с предупреждением.

3. **Тесты**
   - `tests/test_pad_placement_normalize.py`
   - `tests/test_pad_placement_score.py`

### Зависимости

- Только чтение правил из [`bottomhole_sync`](../../decision-matrix/backend/app/services/well_trajectory/bottomhole_sync.py).
- Отдельный микросервис на M1 **не нужен**.

---

## M2 — Оптимизатор и API расчёта

### Алгоритм

1. `k` от 1 до «округление вверх(N ÷ max на куст)».
2. Для каждого `k` — разбиения скважин на k групп (полный перебор при N ≤ 8, иначе k-means по координатам TD в плане).
3. Для каждого разбиения:
   - перебор центра куста в сетке вокруг центроида TD (M2+, минимизация Σ MD) или legacy heel-сдвиг при `center_optimize=false`;
   - виртуальный куст → `generate_pad_sketch_from_wells` → цепочка траекторий;
   - реальный `design-from-bottomholes` через [`planner_bridge`](../../decision-matrix/backend/app/services/well_trajectory/planner_bridge.py).
4. Отсортировать; оставить топ-K = 5.

### API

- `POST /projects/{id}/pad-placement/compute`
- Ответ: `PadPlacementComputeResponse` (см. модель данных).
- Синхронно: N ≤ 8 и не больше 100 вариантов; иначе 400 с подсказкой использовать async.

### Производительность

- Кэш результатов design в рамках одного запроса.
- Таймаут на вариант (например 30 с) → пропуск с предупреждением.

---

## M3 — Frontend (карта)

### Целевые файлы

```
frontend/src/
  lib/api/padPlacementApi.ts
  hooks/usePadPlacementEditor.ts
  components/mapView/PadPlacementPanel.tsx
  components/mapView/useMapViewPadPlacementSync.ts   # слой предпросмотра
```

### Сценарий в UI

1. Панель инструментов: «Оптимизация кустов» → режим выбора забоев.
2. Панель параметров + «Рассчитать».
3. Таблица вариантов; клик по строке — подсветка на карте.
4. «Применить» → подтверждение → обновление объектов и GeoJSON.

### Интеграция с картой

- По образцу [`AutoroadNetworkPanel`](../../decision-matrix/frontend/src/components/mapView/) и [`useMapPageOrchestrator`](../../decision-matrix/frontend/src/hooks/mapPageOrchestrator/).
- Id слоя предпросмотра: `pad-placement-preview`.

---

## M4 — Применение и фоновые задачи

### Транзакция apply

1. Для каждого куста варианта — `create_infra_object` (`oil_pad` / `gas_pad`).
2. Свойства: контур, `wells_local`, траектории.
3. Обновление забоев: `linked_pad_id`, `well_index`.
4. Сброс кэша GeoJSON проекта.

### Фоновый режим

- Тип задачи `JOB_TYPE_PAD_PLACEMENT_COMPUTE` в [`project_jobs`](../../decision-matrix/backend/app/services/project_job_run.py).
- Payload — тело compute + `request_id`.
- UI — [журнал задач](../features/task-log-panel.md).

### Права

- compute / apply — `write_infra`.
- чтение результата — read на проект.

---

## M5 — Учёт SF (anti-collision)

- После design по варианту — опционально clearance по скважинам варианта (до apply — временные id в preview).
- Третий критерий оценки: число пар с `min_sf` ниже порога.
- Колонка «min SF» в таблице вариантов.

---

## Риски и меры

| Риск | Что делаем |
|------|------------|
| Слишком много комбинаций при N > 10 | Ограничить N; фон; только эвристические разбиения |
| Часто падает design welleng | Fallback MD → TVD из забоя; вариант «частичный» с предупреждением |
| Новый куст слишком близко к существующему | Проверка `min_pad_spacing_m` в плане |
| Путают с `pads_count` в POI | Подсказка в панели + документация |

---

## Вне всех этапов

- Смешанный режим (старые + новые кусты в одном расчёте).
- Инструменты AI-помощника (MCP) — позже.
- Отдельный мобильный UI.

---

## История изменений

| Дата | Изменение |
|------|-----------|
| 2026-06 | Первый план D0–M5 |
| 2026-06 | Переписано простым русским языком |
| 2026-06 | M2+: `placement_optimize.py`, перебор центра по Σ MD, UI «Расширенные» |
