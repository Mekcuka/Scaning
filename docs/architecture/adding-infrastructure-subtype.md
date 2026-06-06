# Как добавить subtype инфраструктуры за один PR

Чеклист для нового subtype (например `lng_terminal`) без правок в оркестраторах `run.py` / `buildMatrixRowsByPois`.

## 1. Определить категорию

| Категория | `param_type` | Пример |
|-----------|--------------|--------|
| Внутренняя линейная | `internal` | `autoroad`, `oil_pipeline` |
| Внешняя линейная | `external_linear` | `gas_pipeline`, `methanol_pipeline` |
| Внешняя точечная | `external` | `gas_processing`, `gtes` |

## 2. Backend — manifest, константы и ставки

1. **`decision-matrix/shared/infrastructure_subtypes.json`** — добавить subtype:
   - `point.map` — если объект на карте
   - `linear.all` — если линейный объект на карте
   - `linear.analysis_internal` / `linear.analysis_external` / `point.analysis_external` — для строк анализа
   - `clusters.*` — если входит в группу смены подтипа (ГКС, узел, куст, ИЭ)
   - `point_policies.*` — immutable, exclusive, facility, import_only, ie_derived, node_derived, pad_derived
   - `labels` / `categories` — подписи и категории для всех map subtypes
   - `point_menu_labels` — переопределения подписи в меню «Точка» (frontend)
   - `legacy_aliases` — устаревшие коды Искра/БД
2. **`backend/app/geo/constants.py`** — re-export policy sets, labels и categories из manifest (не дублировать списки вручную).
3. **`backend/app/services/cost_rates.py`** — ставка в `DEFAULT_COST_RATES` (списки subtypes берутся из manifest автоматически).
4. **`backend/app/services/analysis/compute.py`** — при необходимости поля лимитов/порогов в `get_distance_maps()`.
5. **`backend/app/services/calculations.py`** — если subtype зав зависит от инженерных решений, обновить `apply_engineering_rules()`.

Реестры builders и `MATRIX_SECTIONS` на frontend подхватят списки из manifest **без правок оркестраторов**.

## 3. Frontend — labels и map-only UI

1. **`frontend/src/lib/api/subtypes.ts`** — группы слоёв (map-only); `SUBTYPE_LABELS` и point policies из manifest.
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
