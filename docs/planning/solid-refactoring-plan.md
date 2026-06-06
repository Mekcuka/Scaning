# План приведения к SOLID

> **Статус:** фаза 6 — **завершена** (июнь 2026); SOLID-план фаз 0–6 выполнен.  
> **Связанные документы:** [module-boundaries.md](../architecture/module-boundaries.md), [architecture.md](../architecture/architecture.md), [frontend-structure.md](../architecture/frontend-structure.md), [implementation-status.md](implementation-status.md).

## Цель

Улучшить поддерживаемость и тестируемость Atlas Grid (`decision-matrix/`) без остановки разработки фич. SOLID применяется **прагматично** — без избыточных абстракций.

## Текущая оценка SOLID (после фаз 0–6 + map split)

| Принцип | Оценка | Комментарий |
|---------|--------|-------------|
| **S** — Single Responsibility | ✅ **~80%** | API split: `projects`, `analysis`, `map_*`; services `infra_create` |
| **O** — Open/Closed | ✅ **~65%** | Реестры analysis/matrix; subtype в нескольких файлах |
| **L** — Liskov Substitution | ✅ N/A | Композиция, без иерархий классов |
| **I** — Interface Segregation | ⚠️ **~55%** | TS/Python порты точечно; `api` — монолитный фасад |
| **D** — Dependency Inversion | ⚠️ **~60%** | planner, spatial, API ports; остальное — прямые импорты |

## Уже сделано (база, не откатывать)

| Область | Артефакт | Принцип |
|---------|----------|---------|
| Карта | `MapPage.tsx` (~45 строк) + `mapPageOrchestrator/*` | SRP |
| API типы | `lib/api/*.ts` (типы по доменам) | SRP (частично) |
| Backend роутеры | `map.py`, `auth.py`, `flow.py`, `sand_logistics.py` и др. | SRP |
| Расчёты | `services/calculations.py` — чистые функции | SRP, тестируемость |
| Planner | `planner_adapter.py` — адаптер внешнего сервиса | DIP (зачаток) |

## Технический долг (приоритет рефакторинга)

| Модуль | Строк (≈) | Проблема | Целевая фаза |
|--------|-----------|----------|--------------|
| ~~`frontend/src/lib/api/apiClient.ts`~~ | ~27 | compose only | фаза 1 ✅ |
| ~~`backend/app/services/infrastructure_analysis.py`~~ | ~37 barrel | пакет `analysis/` | фаза 2 ✅ |
| ~~`frontend/.../useMapPageMapActions.ts`~~ | ~35 compose | actions/* | фаза 3 ✅ |
| ~~`backend/app/api/v1/router.py`~~ | ~34 | compose only | фаза 6 ✅ |
| ~~`backend/app/api/v1/map.py`~~ | ~38 | compose only | map split ✅ |
| ~~`ImportPage.tsx`, `Import3DPage.tsx`~~ | ~75 / ~220 | workflow hooks | фаза 3 ✅ |
| `buildMapPageSections.ts` | ~416 | props mapping | опционально |

## Метрики готовности этапа

| Метрика | Целевое значение |
|---------|------------------|
| Размер «горячего» файла | ≤ 300–400 строк (исключения — с обоснованием в PR) |
| Покрытие тестами затронутого модуля | не ниже текущего |
| CI | зелёный после каждого PR |
| Новые `Protocol` / TS-интерфейсы | только с ≥1 реальной реализацией или mock |

---

## Фаза 0 — Границы модулей ✅

**Срок:** 3–5 дней. **Статус:** завершена (июнь 2026).

### Задачи

- [x] Документ плана SOLID (этот файл)
- [x] Карта границ модулей — [module-boundaries.md](../architecture/module-boundaries.md)
- [x] Чеклист PR для рефакторинга — см. ниже и [CONTRIBUTING.md](../../CONTRIBUTING.md)
- [x] Перекрёстные ссылки в architecture / frontend-structure / development-plan / README

### Критерий готовности

- [x] Границы модулей зафиксированы в документации
- [x] Правило «новый код >300 строк → отдельный модуль» описано
- [x] Чеклист ревью доступен контрибьюторам

---

## Фаза 1 — SRP + ISP: `apiClient.ts` ✅

**Срок:** 1–2 недели. **Статус:** завершена (июнь 2026).

**Целевая структура:**

```
frontend/src/lib/api/
├── client.ts              # request, cookies, errors
├── authApi.ts
├── projectsApi.ts
├── mapApi.ts
├── analysisApi.ts
├── importApi.ts
├── jobsApi.ts
├── adminApi.ts
├── apiClient.ts           # compose: export const api = { ... }
└── index.ts
```

**Шаги:** вынести домены по одному PR; сохранить `export const api` для обратной совместимости; новый код импортирует узкий `*Api`.

**Критерий:** `apiClient.ts` ≤ 80 строк; доменные файлы ≤ 150 строк.

### Выполнено

- [x] `authApi`, `adminApi`, `projectsApi`, `analysisApi`, `mapApi`, `networkApi`, `importApi`, `jobsApi`, `sandLogisticsApi`, `flowApi`, `onePagerApi`
- [x] `apiClient.ts` — compose (~25 строк)
- [x] Экспорт доменных API из `lib/api.ts` и `lib/api/index.ts`
- [x] Smoke-тест `apiClient.test.ts` (полнота compose, нет дубликатов ключей)
- [x] Обратная совместимость: `import { api } from '../lib/api'`

---

## Фаза 2 — SRP: `infrastructure_analysis.py` ✅

**Срок:** 2 недели. **Статус:** завершена (июнь 2026).

**Целевая структура:**

```
backend/app/services/analysis/
├── compute.py           # чистые функции, без async/БД
├── external_items.py
├── persist.py
├── read.py
├── run.py               # оркестрация run_poi_analysis
└── __init__.py          # публичный API
```

**Критерий:** `compute.py` тестируется без БД; `run.py` — с mock store.

### Выполнено

- [x] `services/analysis/compute.py` — чистые функции
- [x] `services/analysis/external_items.py` — manual override rows
- [x] `services/analysis/persist.py` — clear + flush
- [x] `services/analysis/read.py` — enrich from DB
- [x] `services/analysis/run.py` — `run_poi_analysis`, `run_project_pois_analysis`
- [x] `infrastructure_analysis.py` — barrel (обратная совместимость)
- [x] `tests/test_analysis_package.py` — smoke + compute без БД

---

## Фаза 3 — SRP: карта и Import ✅

**Срок:** 2–3 недели. **Статус:** завершена (июнь 2026).

### 3a. `useMapPageMapActions.ts`

```
hooks/mapPageOrchestrator/actions/
├── useMapDrawActions.ts
├── useMapSelectionActions.ts
├── useMapInfraActions.ts
├── useMapAutoroadActions.ts
├── useMapAnalysisActions.ts
└── useMapPageMapActions.ts   # compose ≤ 100 строк
```

### 3b. Import-страницы

```
pages/import/
├── ImportPage.tsx
├── useImportWorkflow.ts
└── компоненты UI
```

**Критерий:** E2E import и map не ломаются.

### Выполнено

- [x] `mapPageOrchestrator/actions/*` — autoroad, draw, selection, analysis, display, interaction
- [x] `useMapPageMapActions.ts` — compose (~35 строк)
- [x] `pages/import/*` — workflow hook + UI sections; `ImportPage.tsx` (~75 строк)
- [x] `pages/import3d/*` — panel, models, upload zone, workflow; `Import3DPage.tsx` (~220 строк)
- [x] Smoke-тест `useMapPageMapActions.test.ts`; Import + Map integration tests green

---

## Фаза 4 — ISP + DIP: точечные абстракции ✅

**Срок:** 2 недели. **Статус:** завершена и верифицирована (июнь 2026).

Только 3 точки подмены:

| Точка | Контракт | Реализации |
|-------|----------|------------|
| Network planner | `NetworkPlannerPort` (Python `Protocol`) | in-process, HTTP |
| Spatial queries | `SpatialQueryPort` | PostGIS, SQLite, mock |
| Frontend API в хуках | `ProjectsApi`, `MapApi` (TS type) | реальный API, mock в тестах |

**Не делать:** репозитории на каждую таблицу, DI-контейнер, Clean Architecture на весь проект.

### Выполнено

- [x] `autoroad_network/planner_port.py` — `NetworkPlannerPort`, `DefaultNetworkPlanner`, `get_network_planner()`
- [x] `spatial_port.py` — `SpatialQueryPort`, `DefaultSpatialQuery`; `run_poi_analysis(..., spatial=)`
- [x] `lib/api/ports/*` — `ProjectsListApiPort`, `ProjectsDataApiPort`, `MapInfraApiPort`
- [x] `useActiveProject`, `useProjectData`, `useMapInfraData` — опциональные API-порты
- [x] Тесты: `test_dip_ports.py`, `apiPorts.test.ts`
- [x] CI: typecheck + 487 Vitest + 232 pytest; моки портов в `apiMockModule.ts`

---

## Фаза 5 — OCP: реестры расширения ✅

**Срок:** ongoing. **Статус:** завершена (июнь 2026).

- Реестр builders строк анализа (backend)
- Реестр строк матрицы (frontend `matrixData`)
- Документ «как добавить subtype за 1 PR»

### Выполнено

- [x] `analysis/builders/` — `InternalLinearBuilder`, `ExternalLinearBuilder`, `ExternalPointBuilder`; `ANALYSIS_PARAM_BUILDERS`
- [x] `run.py` — оркестратор через реестр (~100 строк)
- [x] `lib/matrixData/` — `MATRIX_SECTIONS`, `MATRIX_CELL_RENDERERS`, cellParts/*
- [x] `docs/architecture/adding-infrastructure-subtype.md`
- [x] Тесты: `test_analysis_builders.py`, `sections.test.ts`

---

## Фаза 6 — SRP backend: `router.py` ✅

**Срок:** 1 неделя. **Статус:** завершена (июнь 2026).

Вынести projects / POI / rates / analysis в `api/v1/projects.py` (и при необходимости `analysis.py`).  
`router.py` — только `include_router(...)`.

**Критерий:** handlers ≤ 15 строк; логика в `services/`.

### Выполнено

- [x] `api/v1/projects.py` — CRUD проектов, rates, economic-params, distance-defaults, POI list/create
- [x] `api/v1/analysis.py` — `analyze-all`, `analyze` POI
- [x] `api/v1/project_deps.py` — `get_user_project`, `get_poi`
- [x] `services/project_setup.py`, `services/poi_create.py` — логика создания
- [x] `router.py` — compose (~35 строк)
- [x] Тесты: `test_api_v1_modules.py`; **236 pytest** green

---

## Post-phase: map.py split ✅

**Статус:** завершена (июнь 2026).

| Модуль | Строк | Ответственность |
|--------|------:|-----------------|
| `map.py` | ~38 | compose |
| `map_layers.py` | ~126 | слои |
| `map_objects.py` | ~408 | объекты, batch-delete, autoroad-connect |
| `map_poi.py` | ~157 | POI CRUD на карте, analysis override |
| `map_import.py` | ~391 | импорт файлов |
| `map_deps.py` | ~78 | access helpers |
| `services/infra_create.py` | ~113 | создание infra object (API + autoroad) |

- [x] Тесты: `test_map_api_modules.py`; **238 pytest** green

---

## Post-phase: subtype manifest v2 ✅

**Статус:** завершена (июнь 2026).

Расширение `infrastructure_subtypes.json` (version 2):

- `point.map` — все point subtypes карты
- `clusters.*` — GKS, node, pad, gtes
- `legacy_aliases` — pad, delivery_acceptance_point

Backend: `geo/constants.py` POINT + clusters + legacy из manifest.  
Frontend: `infrastructureSubtypesManifest.ts` → `subtypes.ts`.

---

## Порядок выполнения PR

| # | Фаза | Эффект | Риск |
|---|------|--------|------|
| 1 | 0 | низкий | минимальный |
| 2 | 1 (API) | высокий ISP | низкий |
| 3 | 2 (analysis) | высокий SRP | средний |
| 4 | 6 (router) | средний SRP | низкий |
| 5 | 3 (map/import) | высокий SRP | средний |
| 6 | 4 (DIP) | тестируемость | средний |
| 7 | 5 (OCP) | долгосрочно | низкий |

---

## Чеклист PR рефакторинга

Использовать при каждом PR в рамках этого плана:

- [ ] Поведение не изменилось (unit; E2E — если затронуты map/import/auth)
- [ ] Старые публичные импорты работают (barrel: `lib/api`, `useMapPageOrchestrator`, `services/analysis`)
- [ ] Новый/изменённый модуль ≤ 400 строк (или обоснование в описании PR)
- [ ] Нет «пустых» абстракций без второй реализации
- [ ] Рефакторинг и фича **не смешаны** в одном PR
- [ ] Обновлена документация при смене структуры папок
- [ ] CI зелёный: lint, typecheck, vitest, pytest

---

## Чего не делать

1. Repository pattern на все модели
2. Полный DI-фреймворк (injector, tsyringe)
3. Интерфейс на каждую функцию
4. Big Bang — один PR на весь SOLID
5. Наследование ради LSP там, где достаточно композиции

---

## Ожидаемый результат (после фаз 1–6)

| Принцип | Станет |
|---------|--------|
| **S** | доменные пакеты ≤ 400 строк |
| **O** | реестры builders/rows для subtypes |
| **L** | без изменений (композиция) |
| **I** | доменные `*Api` + compose |
| **D** | 3 порта: planner, spatial, api slices |
