# Как добавить subtype инфраструктуры за один PR

Чеклист для нового subtype (например `lng_terminal`) без правок в оркестраторах `run.py` / `buildMatrixRowsByPois`.

## 1. Определить категорию

| Категория | `param_type` | Пример |
|-----------|--------------|--------|
| Внутренняя линейная | `internal` | `autoroad`, `oil_pipeline` |
| Внешняя линейная | `external_linear` | `gas_pipeline`, `methanol_pipeline` |
| Внешняя точечная | `external` | `gas_processing`, `gtes` |

## 2. Backend — константы и ставки

1. **`backend/app/geo/constants.py`** — добавить subtype в `LINEAR_SUBTYPES` или `POINT_SUBTYPES` (если объект отображается на карте).
2. **`backend/app/services/cost_rates.py`** — добавить в нужный кортеж:
   - `ANALYSIS_LINEAR_SUBTYPES` (internal)
   - `EXTERNAL_LINEAR_SUBTYPES` (external_linear)
   - `EXTERNAL_POINT_SUBTYPES` (external)
   - и ставку в `DEFAULT_COST_RATES`.
3. **`backend/app/services/analysis/compute.py`** — при необходимости поля лимитов/порогов в `get_distance_maps()` (POI + `ProjectDistanceDefaults`).
4. **`backend/app/services/calculations.py`** — если subtype зависит от инженерных решений, обновить `apply_engineering_rules()`.

Реестр builders (`analysis/builders/`) **не менять** — он итерирует кортежи из `cost_rates.py`.

## 3. Frontend — каталог и матрица

1. **`frontend/src/lib/api/subtypes.ts`** — subtype, `SUBTYPE_LABELS`, группы слоёв (синхрон с `constants.py`).
2. **`frontend/src/lib/matrixData/sections.ts`** — добавить subtype в нужную секцию `MATRIX_SECTIONS` (OCP-реестр).
3. При необходимости — иконка/стиль на карте (`mapConstants`, layer prefs).

Реестр рендереров (`MATRIX_CELL_RENDERERS`) **не менять**, если `param_type` стандартный.

## 4. Тесты (минимум)

- Backend: `tests/test_analysis_builders.py` (реестр покрывает param_type) + unit на формулу/статус при нестандартной логике.
- Frontend: `lib/matrixData/sections.test.ts` — subtype в нужной секции.
- Интеграция: smoke анализа POI или строка матрицы в существующем тесте.

## 5. Миграция БД

Только если нужны новые колонки POI / distance defaults — Alembic migration в том же PR.

## Файлы, которые **не** трогать при стандартном subtype

| Файл | Причина |
|------|---------|
| `analysis/run.py` | Оркестратор через `ANALYSIS_PARAM_BUILDERS` |
| `analysis/builders/*.py` | Логика по `param_type`, не по subtype |
| `matrixData/buildMatrixRows.ts` | Итерирует `MATRIX_SECTIONS` |
| `matrixData/cellRenderer.ts` | Dispatch по `param_type` |

## Пример PR (внешняя точечная)

```
cost_rates.py          + EXTERNAL_POINT_SUBTYPES
constants.py           + POINT_SUBTYPES
subtypes.ts            + label + layer group
sections.ts            + subtype в external section
compute.py             + threshold_map entry (если нужен лимит)
test_analysis_builders.py / sections.test.ts
```
