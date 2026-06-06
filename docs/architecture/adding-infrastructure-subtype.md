# Как добавить subtype инфраструктуры за один PR

Чеклист для нового subtype (например `lng_terminal`) без правок в оркестраторах `run.py` / `buildMatrixRowsByPois`.

## 1. Определить категорию

| Категория | `param_type` | Пример |
|-----------|--------------|--------|
| Внутренняя линейная | `internal` | `autoroad`, `oil_pipeline` |
| Внешняя линейная | `external_linear` | `gas_pipeline`, `methanol_pipeline` |
| Внешняя точечная | `external` | `gas_processing`, `gtes` |

## 2. Backend — manifest, константы и ставки

1. **`decision-matrix/shared/infrastructure_subtypes.json`** — добавить subtype в нужный список:
   - `linear.analysis_internal` (internal)
   - `linear.analysis_external` (external_linear; обычно = `linear.all`)
   - `point.analysis_external` (external)
2. **`backend/app/geo/constants.py`** — если объект отображается на карте, добавить в `POINT_SUBTYPES` (map-only subtypes).
3. **`backend/app/services/cost_rates.py`** — ставка в `DEFAULT_COST_RATES` (списки subtypes берутся из manifest автоматически).
4. **`backend/app/services/analysis/compute.py`** — при необходимости поля лимитов/порогов в `get_distance_maps()`.
5. **`backend/app/services/calculations.py`** — если subtype зав зависит от инженерных решений, обновить `apply_engineering_rules()`.

Реестры builders и `MATRIX_SECTIONS` на frontend подхватят списки из manifest **без правок оркестраторов**.

## 3. Frontend — labels и map-only UI

1. **`frontend/src/lib/api/subtypes.ts`** — `SUBTYPE_LABELS`, группы слоёв (map-only; analysis lists из manifest).
2. При необходимости — иконка/стиль на карте (`mapConstants`, layer prefs).

Реестр `MATRIX_SECTIONS` и `MATRIX_CELL_RENDERERS` **не менять**, если `param_type` стандартный.

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
