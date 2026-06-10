# План приведения к SOLID

> **Статус:** фаза 13 (map_import polish) — **завершена** (июнь 2026); фазы 0–13 выполнены.  
> **Связанные документы:** [module-boundaries.md](../architecture/module-boundaries.md), [architecture.md](../architecture/architecture.md), [frontend-structure.md](../architecture/frontend-structure.md), [implementation-status.md](implementation-status.md).

## Цель

Улучшить поддерживаемость и тестируемость Atlas Grid (`decision-matrix/`) без остановки разработки фич. SOLID применяется **прагматично** — без избыточных абстракций.

## Текущая оценка SOLID (после фаз 0–7 + map split)

| Принцип | Оценка | Комментарий |
|---------|--------|-------------|
| **S** — Single Responsibility | ✅ **~85%** | API split; `assistant/chat/*` декомпозирован (фаза 7) |
| **O** — Open/Closed | ✅ **~65%** | Реестры analysis/matrix; subtype в нескольких файлах |
| **L** — Liskov Substitution | ✅ N/A | Композиция, без иерархий классов |
| **I** — Interface Segregation | ✅ **~70%** | Порты sand/flow/one-pager + projects/map (фаза 10) |
| **D** — Dependency Inversion | ✅ **~75%** | planner, spatial, API ports, `LlmClientPort` + `ToolRegistryPort` (фазы 11–12) |

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
| `buildMapPageSections/` | ~50 each | props mapping per section | **✅ split** |

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
| `map_objects.py` | ~280 | объекты, batch-delete, autoroad-connect (HTTP only) |
| `services/infra_update.py` | ~110 | PATCH infra object |
| `services/infra_delete.py` | +clear | batch delete + clear project infra |
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

## Post-phase: subtype manifest v3 ✅

**Статус:** завершена (июнь 2026).

- `point_policies.*` — immutable, exclusive, facility, import_only, ie_derived, node_derived, pad_derived, spark_exclusive
- Backend validation и frontend menu hidden — из одного JSON

---

## Post-phase: subtype manifest v4 ✅

**Статус:** завершена (июнь 2026).

- `labels` / `categories` — все map subtypes (backend + frontend)
- `point_menu_labels` — переопределения UI меню «Точка» (gtes → ИЭ, oil_pad → Куст)

---

## Фаза 7 — SRP: `assistant/chat/orchestrator.py` ✅

**Срок:** 1 неделя. **Статус:** завершена (июнь 2026).

**Целевая структура:**

```
backend/app/assistant/chat/
├── orchestrator.py      # run_chat, run_chat_stream, _chat_events (~260 строк)
├── prompt.py            # system prompt, data hints, tool_env
├── message_history.py   # llm_messages, history slimming
├── tool_payload.py      # slim schema, compact/summarize list tools
├── tool_loop.py         # execute tools, confirm, finalize message
└── events.py            # ChatStreamEvent
```

**Критерий:** `orchestrator.py` ≤ 300 строк; вспомогательные модули ≤ 200 строк; barrel-реэкспорт `_user_wants_data`, `_compact_tool_payload_for_llm` для тестов.

### Выполнено

- [x] Декомпозиция монолита (~706 строк) → 6 модулей
- [x] `orchestrator.py` — compose + публичный API без изменения поведения
- [x] Тесты: `test_assistant_chat.py`, `test_assistant_reasoning_content.py` — 32 passed
- [x] Smoke: `test_orchestrator_modules.py`

---

## Фаза 8 — SRP: `PoiParamsForm.tsx` ✅

**Срок:** 1 неделя. **Статус:** завершена (июнь 2026).

**Целевая структура:**

```
frontend/src/components/
├── PoiParamsForm.tsx              # barrel re-export
└── poiParamsForm/
    ├── PoiParamsForm.tsx          # compose (~120 строк)
    ├── PoiBasicFlatSection.tsx
    ├── PoiBasicAccordionSection.tsx
    ├── PoiEngineeringSection.tsx
    ├── PoiThresholdGrid.tsx
    ├── PoiNumberField.tsx
    ├── PoiAccordionSection.tsx
    ├── types.ts, constants.ts, formatNum.ts
    └── PoiParamsForm.test.tsx
```

**Критерий:** главный compose ≤ 150 строк; секции ≤ 200 строк; `import { PoiParamsForm } from '../components/PoiParamsForm'` без изменений.

### Выполнено

- [x] Монолит (~548 строк) → 10 модулей
- [x] Flat-режим (панель объекта) и accordion (страницы проекта) разделены по секциям
- [x] Vitest: `PoiParamsForm.test.tsx`; `npm run build` green

---

## Фаза 9 — SRP: `import_service.py` ✅

**Срок:** 1 неделя. **Статус:** завершена (июнь 2026).

**Целевая структура:**

```
backend/app/services/
├── import_service.py          # barrel (~45 строк)
└── file_import/
    ├── csv_parser.py
    ├── geojson_parser.py
    ├── kml_parser.py
    ├── shapefile.py
    ├── persist.py             # import_rows_to_layer
    ├── parse.py               # detect + dispatch
    └── run.py                 # logs, jobs, run_file_import
```

**Критерий:** `import_service.py` — только re-export; парсеры без SQL; `persist.py` — без HTTP.

### Выполнено

- [x] Монолит (~608 строк) → 7 модулей + barrel
- [x] Обратная совместимость: `_parse_csv_rows`, `_parse_geojson` для тестов
- [x] Тесты: `test_file_import_package.py`, `test_render_3d_import.py`, `test_import_service_rows.py`, `test_import_geojson.py` — 10 passed

---

## Фаза 10 — ISP: узкие `*Api` порты (sand, flow, report) ✅

**Срок:** ongoing. **Статус:** завершена (июнь 2026), первая волна.

**Порты:** `lib/api/ports/sandLogisticsApiPort.ts`, `flowApiPort.ts`, `onePagerApiPort.ts`.

**Миграция:**

| Домен | Хук / страница | Порт |
|-------|----------------|------|
| Песок | `useProjectSandLogistics`, `runApiJob` | `SandLogisticsReadApiPort` / `SandLogisticsApiPort` |
| Потоки | `FlowSchematicLayout` | `FlowSchematicApiPort` |
| Отчёты | `useOnePagerList`, `ReportEditorPage` | `OnePagerListApiPort` / `OnePagerEditorApiPort` |

**Критерий:** хуки принимают `options.*Api`; тесты инжектят mock без `vi.mock` всего `api`; `apiMockModule` синхронизирует default ports.

### Выполнено

- [x] 3 новых порта + расширение `apiPorts.test.ts`
- [x] `useOnePagerList` — новый хук для списка отчётов
- [x] `useProjectSandLogistics.test.tsx` — DIP через inject mock port
- [x] `apiMockModule` — wiring для flow/sand/one-pager ports

### Волна 2 (map + jobs + projects write)

- [x] `MapAnalysisApiPort` → `useMapAnalysis`
- [x] `ProjectJobsApiPort` → `useActiveProjectJob`
- [x] `MapMutationsApiPort` → `useMapClipboard`, `useMapDeleteSelection`
- [x] `ProjectsWriteApiPort` / `ProjectsPoiWriteApiPort` → `useDeleteProjectDialog`, delete POI on map

### Волна 3 (map create/edit + autoroad)

- [x] Расширены `MapMutationsApiPort` (create/update infra), `ProjectsPoiWriteApiPort` (create/update POI)
- [x] `ProjectsMapSettingsApiPort`, расширен `MapDataApiPort` (layers, 3D models)
- [x] `AutoroadNetworkApiPort` → `useMapAutoroadNetwork`
- [x] `useMapInfraCreate`, `useMapLineDrawing`, `useMapDetailSave`, `useMapGeometrySave`
- [x] `useMapPageMapData`, `submitPoi` (типы без `api`)

### Волна 4 (lib map utilities)

- [x] `MapUndoApiPort` / `NetworkBuildApiPort` → `mapUndo`, `applyInfraLineSplit`
- [x] `mapClipboard` — типы через `projectsApi` (без `api`)
- [x] хуки передают `mapApi` в `applyInfraLineSplit`

### Волна 5 (jobs + project pages)

- [x] `ProjectJobsApiPort` + `getProjectJob` → `pollProjectJob`
- [x] `AnalysisBatchApiPort` → `runApiJob.analyzeAllPoisAndWait`
- [x] `ProjectsRatesApiPort`, расширены `ProjectsDataApiPort` / `ProjectsWriteApiPort`
- [x] `ParametersPage`, `SandParametersPage`, `EntryDatesParametersPage` → `MapMutationsApiPort`
- [x] `RatesPage`, `ProjectsPage`, `DashboardPage`, `ProjectDetailPage`, `MatrixPage`, `FlowsIndexRedirect`

### Волна 6 (import, admin, components)

- [x] `ImportWorkflowApiPort` → `useImportPageWorkflow`
- [x] `Map3dModelsApiPort` → `useImport3dWorkflow`
- [x] `AdminUsersApiPort`, `AdminJobsApiPort` → admin pages
- [x] `AuthSessionApiPort` → `ReportEditorPage`
- [x] `PoiParamsPanel`, `ProjectDistanceDefaultsForm`, `useObjectDetailPanel`, `CandidatesModal`, `TaskLogPanel`

### Волна 7 (auth store + export/flows)

- [x] `AuthApiPort` → `store` (login/register/me)
- [x] `useExportPage` → `MapDataApiPort`
- [x] `FlowSchematicLayout` → `ProjectsPoiWriteApiPort`

**Итог фазы 10:** production-код переведён на порты; `export const api` сохранён для тестов и обратной совместимости.

---

## Фаза 11 — DIP: assistant LLM port ✅

**Срок:** 1 неделя. **Статус:** завершена (июнь 2026).

**Цель:** оркестратор и status endpoints зависят от абстракции LLM-провайдера, а не от httpx-функций напрямую.

**Структура:**

```
backend/app/assistant/chat/
├── ports/
│   ├── __init__.py
│   └── llm_port.py       # LlmClientPort (Protocol), HttpLlmClient, default_llm_client
├── llm_client.py         # httpx-реализация (без изменений публичного API)
└── orchestrator.py       # inject llm_client; shim chat_completion* для @patch в тестах
```

### Выполнено

- [x] `LlmClientPort` — `chat_completion`, `chat_completion_stream`, `probe_provider`
- [x] `HttpLlmClient` + `default_llm_client`
- [x] `orchestrator.run_chat` / `run_chat_stream` — опциональный `llm_client`
- [x] `api/v1/assistant.py`, `tools/domain/session.py` → `default_llm_client.probe_provider()`
- [x] Тесты: `test_llm_port.py`, `test_orchestrator_modules.py`; существующие `@patch orchestrator.chat_completion` сохранены
- [x] `llm_client.py` остаётся единственным местом httpx-вызовов

---

## Фаза 12 — DIP: assistant tool registry port ✅

**Срок:** 1 неделя. **Статус:** завершена (июнь 2026).

**Цель:** chat tool loop, HTTP MCP и dev stdio зависят от абстракции registry, а не от прямых импортов `registry.py`.

**Структура:**

```
backend/app/assistant/
├── ports/
│   ├── __init__.py
│   └── tool_registry_port.py   # ToolRegistryPort, DefaultToolRegistry, default_tool_registry
├── registry.py                 # in-process реализация (без изменений публичного API)
└── chat/tool_loop.py           # inject tool_registry; shim execute_tool/get_tool
```

### Выполнено

- [x] `ToolRegistryPort` — `get_tool`, `list_tools`, `execute_tool`
- [x] `DefaultToolRegistry` + `default_tool_registry`
- [x] `tool_loop.execute_llm_tool_calls` / `execute_confirmed_events` — опциональный `tool_registry`
- [x] `orchestrator` — проброс `tool_registry` в tool loop
- [x] `transport/http_mcp.py`, `dev/domain_proxy.py` → `default_tool_registry`
- [x] Тесты: `test_tool_registry_port.py`; assistant suite green

---

## Фаза 13 — SRP: `map_import.py` polish ✅

**Срок:** 3–5 дней. **Статус:** завершена (июнь 2026).

**Цель:** убрать дублирование decode KML/KMZ, sync/async import и commit из HTTP handlers.

**Структура:**

```
backend/app/services/file_import/
├── upload_decode.py    # decode_csv/kml/geojson, preview helper
└── workflows.py        # ImportUploadSpec, commit_sync_*, enqueue_async_*

backend/app/api/v1/map_import.py   # тонкие handlers (~280 → ~270 строк, без inline zipfile)
```

### Выполнено

- [x] `upload_decode.py` — единый KML/KMZ decode (`strict_kmz` для sync)
- [x] `workflows.py` — `ImportUploadSpec` + sync/async commit/enqueue
- [x] `map_import.py` — handlers без дублирования `ActiveProjectJobError` / zipfile
- [x] Тесты: `test_upload_decode.py`

---

## Assistant roadmap: Wiki RAG (phase 10.2) ✅

**Статус:** завершена (июнь 2026).

- [x] `chunking.py` — разбиение статей по `##`
- [x] `tfidf.py` + `embeddings.py` — offline fallback и OpenAI-compatible `/embeddings`
- [x] `rag.py` — hybrid search, disk cache, `GET /assistant/status` → `wiki_rag_*`
- [x] `search_wiki` async + поле `mode` в ответе
- [x] Тесты: `test_assistant_wiki_rag.py`

---

## Assistant roadmap: история чата в БД (phase 8.2) ✅

**Статус:** завершена (июнь 2026).

- [x] `assistant_chat_sessions`, `assistant_chat_messages` + migration `021`
- [x] `chat/history.py` — persist turn, list/create/delete
- [x] API: `GET/POST /assistant/sessions`, `GET/DELETE .../messages`
- [x] `ChatRequest.session_id`, `ChatResponse.session_id`
- [x] Frontend: `useAssistantChatSession`, selector в `AssistantPanel`
- [x] Тесты: `test_assistant_chat_history.py`

**Дальше:** assistant 7.3 (context overflow fallback).

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
