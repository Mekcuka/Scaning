# Статус реализации приложения

> **Назначение:** единая точка согласования документации `docs/` с кодом `decision-matrix/`.  
> **Дата:** июнь 2026. **Траектории:** M1 ✅, M2 ✅, M3 ✅. При изменении продукта обновляйте этот файл и [consistency-review.md](consistency-review.md).

## Область

| Компонент | Путь | В scope |
|-----------|------|---------|
| СППР (prod) | `decision-matrix/` | да |
| Документация | `docs/` | да |

## Краткий итог

| Категория | Оценка |
|-----------|--------|
| Must Have MVP (FR из [requirements.md](../product/requirements.md)) | **~85%** |
| Should Have | **~65%** |
| Функции сверх базового ТЗ (3D, PFD, песок, Искра, расширенная карта) | реализованы, описаны в отдельных doc |
| Автотесты | backend `app/` ~72%, frontend `pages/` ~79% ([testing-strategy.md](../testing/testing-strategy.md)) |

---

## Навигация UI (факт)

Боковое меню (`AppLayout.tsx`), видимость по роли — `lib/permissions.ts`.

**Проектные маршруты** включают UUID активного проекта в **конце** пути: `/map/{projectId}`, `/matrix/{projectId}`, … Код: [`projectRoutes.ts`](../../decision-matrix/frontend/src/lib/projectRoutes.ts), `ProjectRouteLayout`, `ProjectLink`, `useProjectPathBuilder`. Старые URL (`/map`, `/{projectId}/map`, …) → редирект на `/раздел/{projectId}` через `LegacyProjectRedirect` / `LegacyPrefixRedirect`.

| Маршрут | Раздел | Роли |
|---------|--------|------|
| `/dashboard/{projectId}` | Дашборд | все |
| `/projects` | Список проектов | admin, analyst, viewer |
| `/projects/:id` | Карточка проекта (POI, анализ) | ↑ |
| `/map/{projectId}` | Карта (+ слой траекторий GeoJSON) | все |
| `/pad-clustering/workspace/{projectId}` | Кустование — **Куст** (раскладка, траектории, 3D); subnav: **Сводка**, **Профиль** | admin, analyst, data_manager, viewer |
| `/parameters/{projectId}` | Параметры (index → последняя вкладка) | admin, analyst, viewer |
| `/parameters/capacity/{projectId}` | Пропускная способность | ↑ |
| `/parameters/sand/{projectId}` | Песок / логистика | ↑ |
| `/parameters/earthwork/{projectId}` | Земляные работы (L/W/H, опорная, поворот) | ↑ |
| `/parameters/entry-dates/{projectId}` | Даты ввода | ↑ |
| `/parameters/rates/{projectId}` | Ставки (16 показателей) | ↑ |
| `/flows/*/{projectId}` | Потоки (PFD) | admin, analyst, viewer |
| `/matrix/{projectId}` | Матрица | admin, analyst, viewer |
| `/report/{projectId}` | Отчёты (одностраничники) | admin, analyst, viewer |
| `/data/{projectId}` | **Данные** (вкладки) | по подмаршруту |
| `/data/import/{projectId}` | Импорт (карточки: файлы, API, инклинометрия) | admin, analyst, data_manager |
| `/data/export/{projectId}` | Экспорт (координаты, GeoJSON) | все роли |
| `/data/import-3d/{projectId}` | Импорт 3D (custom GLB) | admin (загрузка); admin + владелец проекта (назначение) |
| `/admin/users`, `/admin/jobs` | Администрирование (пользователи, журнал задач) | admin |

**Отличие от FR-12.2.2:** отдельного пункта «Ставки» нет — ставки внутри **«Параметры»**; добавлены **«Параметры»**, **«Потоки»** и группа **«Данные»** (импорт/экспорт/3D). Редиректы: `/` → `/dashboard/{projectId}`; `/rates` → `/parameters/rates/{projectId}`; `/import`, `/export`, `/import-3d` → `/data/.../{projectId}`; `/{projectId}/*` → suffix через `LegacyPrefixRedirect`; прочие legacy-пути — `LegacyPathPreserveRedirect`.

---

## Backend: модули и файлы

| Модуль | API / сервисы | Статус |
|--------|---------------|--------|
| Auth + RBAC | `api/v1/auth.py`, `admin.py`, `admin_jobs.py`, `services/auth_tokens.py`, `project_access.py` | ✅ |
| Фоновые задачи (проект) | `project_jobs.py`, `job_queue.py` (enqueue в `ARQ_QUEUE_NAME`), `project_job_run.py`, worker | ✅ |
| Фоновые задачи (admin) | `api/v1/admin_jobs.py`, `services/admin_jobs.py` | ✅ |
| Проекты, POI, ставки, пороги | `api/v1/router.py`, `services/cost_rates.py`, `calculations.py` | ✅ |
| Карта, слои, объекты | `api/v1/map.py` | ✅ |
| Custom GLB 3D (`project_map3d_models`) | `api/v1/map3d_models.py`, `services/map3d_custom_models.py`, миграции `015`–`016`, **`022`** (метаданные, usage_count, bulk apply); volume на prod — [map3d-models-storage.md](../deploy/map3d-models-storage.md); клиент: `Import3DPage`, `map3dCustomGlbFetch.ts` | ✅ |
| Анализ окружения | `services/infrastructure_analysis.py`, `spatial.py` | ✅ |
| Импорт | `services/import_service.py`, `spark_import.py`, `import_connections.py` | ✅ |
| Async import | `schedule_async_import` (фоновые задачи asyncio, **не** Celery) | ✅ |
| Одностраничники | `api/v1/one_pagers.py`, `one_pager_pptx.py` | ✅ |
| Граф сети | `api/v1/graph.py`, `graph_builder.py` | ✅ (визуализация/PFD; якорь `network_node` в анализе POI — post-MVP) |
| Схема потоков | `api/v1/flow.py`, `fluid_flow_schematic.py`, `flow_schematic_merge.py` | ✅ |
| Песок / логистика | `api/v1/sand_logistics.py`, `sand_logistics.py`, `sand_logistics_store.py` | ✅ (результат в БД; схема: timeline, полная топология на любом годе, layout/slice, адаптивные отступы) |
| Земляные работы площадки | `pad-earthwork-planner` + BFF; все точечные объекты кроме `node` (включая **карьер песка**); карта: L/W/H, **Схема…**, DEM; режим **Площадки** (контуры footprint, **точки подключения** линий); **Параметры → Земляные работы** — табличное редактирование габаритов; **Параметры → Точки подключения** — шаблон cardinal + bulk apply; **Генератор** только кусты — [pad-earthwork.md](../features/pad-earthwork/pad-earthwork.md) | ✅ flat + plan + envelope + DEM + 3D preview + footprints |
| Траектории скважин (3D) | `well-trajectory-planner` (welleng) + BFF — [well-trajectory.md](../features/well-trajectory/well-trajectory.md), [план реализации](../features/well-trajectory/well-trajectory-implementation-plan.md), [оценка приложения](../features/well-trajectory/well-trajectory-app-assessment.md) | ✅ **M1 ✅, M2 ✅, M3 ✅, M4a ✅** — BFF, «Кустование», забои (+ **геометрия X/Y/Z**, dual TVD ГС, **точка входа `any`/Т1/Т3 + SF**), GeoJSON 2D/3D, anti-collision SF, **импорт CSV / `.wbp`**, E2E smoke; WITSML 4b — в планах |
| Оптимизация размещения кустов | BFF `pad-placement/*`, `services/pad_placement/` (`placement_optimize.py` — двухфазный перебор центра; `trajectory_design.py` — адаптивный entry ГС); jobs `pad_placement_compute` / `apply` — [pad-placement-optimization.md](../features/pad-placement/pad-placement-optimization.md), [plan](../features/pad-placement/pad-placement-optimization-plan.md) | ✅ **M1–M5 + M2+** |
| Экономика потоков | `economic_flow_schematic.py`, `economic_rates.py` | ✅ |
| Автосеть автодорог | `network-planner` + `planner_adapter.py`: Steiner tree, post-processing, preview overlay; BFF request/compute/apply | ✅ |
| Autoroad Network Service (HTTP :8080) | `autoroad-network-planner/` microservice | ⬜ опционально (`AUTOROAD_NETWORK_INPROCESS=false`) |
| AI Assistant (Tool Registry) | `app/assistant/` — 39 tools (31 read + 8 mutating), HTTP MCP, chat UI + SSE, dev stdio MCP, `tests/test_assistant_*` | ✅ фазы 1–8 |
| AI Assistant (фаза 9) | mutating tools + confirm, HTTP MCP block, audit log, rate limits, MCP UX, dev domain proxy, admin LLM override — [assistant.md §18](../architecture/assistant.md) | ✅ |
| AI Assistant (фаза 7) | tool routing (`tool_router.py`), formatters registry (`chat/formatters/`, tool-first, analysis/admin/flow/sand, `answer_source`) — [assistant.md §16](../architecture/assistant.md) | ✅ 7.1–7.2, 7.5 |
| AI Assistant (фаза 10) | product wiki: `docs/wiki/`, bundle, `search_wiki` tools, MCP `wiki://*`, chat chips — [assistant.md §19](../architecture/assistant.md) | ✅ |
| AI Assistant (roadmap) | фаза 7.3 (context fallback), 7.4 (остальные status hints), 8.2 (история чата в БД), 10.2 (wiki RAG) — [assistant.md](../architecture/assistant.md) | planned |
| UI «Построить сеть» | `MapPage` drawMode `autoroad_network`, `AutoroadNetworkPanel` (массовый выбор, параметры), `AutoroadNetworkParamsSection` | ✅ |
| UI «Оптимизация кустов» | `MapPage` drawMode `pad_placement`, `PadPlacementPanel` (+ «Расширенные»: center optimize), preview GeoJSON, async compute, apply → новые кусты | ✅ |

**БД:** SQLite (`run_local.py`) или PostgreSQL + PostGIS (`DATABASE_URL` в `.env`). Geodesic: PostGIS `geography` или haversine fallback.

---

## Frontend: страницы

| Маршрут | Компонент | Статус |
|---------|-----------|--------|
| `/login`, `/register` | `LoginPage`, `RegisterPage` | ✅ |
| `/dashboard/{projectId}` | `DashboardPage` | ✅ |
| `/projects`, `/projects/:id` | `ProjectsPage`, `ProjectDetailPage` | ✅ |
| `/map/{projectId}` | `MapPage` + `MapView` (2D) / `MapView3D` (+ слой траекторий GeoJSON) | ✅ |
| `/pad-clustering/workspace/{projectId}` | `PadClusteringLayout` — subnav **Куст** / **Сводка** / **Профиль**; sidebar + 3D, read-only сводка, MD–TVD + Excel | ✅ |
| `/pad-clustering/summary/{projectId}` | `PadClusteringSummaryPage` — единая таблица параметров расчёта | ✅ |
| `/pad-clustering/profile/{projectId}` | `PadClusteringProfilePage` — график MD–TVD, станции, маркеры Т1/Т3 (ГС) | ✅ |
| `/pad-clustering/{projectId}` | redirect → workspace | ✅ |
| `/map/{projectId}` (режим «Оптимизация кустов») | `PadPlacementPanel`, preview GeoJSON, async compute, apply → новые кусты | ✅ |
| `/parameters/*/{projectId}` | `ParametersPage`, `SandParametersPage`, … | ✅ |
| `/matrix/{projectId}` | `MatrixPage` | ✅ |
| `/report/*/{projectId}` | `ReportListPage`, `ReportEditorPage`, … | ✅ |
| `/data/*/{projectId}` | `DataLayout` + `ImportPage`, `ExportPage`, `Import3DPage` | ✅ |
| `/data/import/{projectId}` | `ImportPage` — карточки (`ExportOptionCard`), панель проекта, история | ✅ |
| `/data/export/{projectId}` | `ExportPage` — выбор проекта, карточки форматов; координаты, GeoJSON (клиент) | ✅ |
| `/data/import-3d/{projectId}` | `Import3DPage` — custom GLB (upload + metadata, PATCH, bulk apply) | ✅ |
| `/flows/*/{projectId}` | `FlowTechnologyPage`, … | ✅ |
| `/admin/users` | `AdminLayout` + `AdminUsersPage` | ✅ |
| `/admin/jobs` | `AdminLayout` + `AdminJobsPage` (health, фильтры, **пагинация 10 записей/стр.**, отмена только `pending`/`running`, автообновление 3 с) | ✅ |

**Оболочка (`AppLayout`):** выход (иконка `LogOut`) в нижней панели сайдбара; в шапке — **заголовок страницы** (`PageHeaderOutlet`), **журнал задач** и переключатель **темы** (глобального селектора проекта в шапке нет). Активный проект — из **URL** (`:projectId`) и store; ссылки в sidebar строятся через `projectPath` / `ProjectLink`.

**3D-карта:** `VITE_MAP_3D_ENABLED`, `VITE_MAPTILER_KEY`, `VITE_API_URL` (обязателен на GitHub Pages) — см. [map-3d-features.md](../features/map/map-3d-features.md), cross-origin auth — [auth-rbac.md](../architecture/auth-rbac.md).

**Панель «Слои» на `/map/{projectId}`:** переключатели подложки, групп подтипов, POI, радиусов — в `localStorage` на проект (`mapLayerPreferences.ts`, ключ `dm-map-layer-prefs:{projectId}`). Видимость импортированных слоёв (`infrastructure_layers.is_visible`) — в БД.

**Загрузка объектов на карте:** гибрид полного кэша + bbox при просмотре (порог 80 объектов, буфер 12%, без лишних `GET` при мелком пане); синхронизация full+bbox кэшей при CRUD/геометрии (`mapQueries.ts`); API [`bbox_filter.py`](../../decision-matrix/backend/app/geo/bbox_filter.py). **Плавность 2D:** rAF на `pointermove`, spatial hit-test (`mapHitTest.ts`), точечный hover, `React.memo(MapView)`, idle-sync слоя при ≥150 объектах, LOD линий по умолчанию 1:500 000 — §6.1.2 [map-objects-and-spatial-calculations.md](../features/map/map-objects-and-spatial-calculations.md). **Drag точек в editMode:** `updateWhileInteracting` + [`mapFeatureGeometrySync.ts`](../../decision-matrix/frontend/src/lib/mapFeatureGeometrySync.ts).

**Рефакторинг frontend (июнь 2026):** монолиты разбиты без смены публичных импортов — `MapPage` ~3836→**~35** (`sections` из `useMapPageOrchestrator`), `MapView` ~2227→~58, `ObjectDetailPanel` ~1163→~168, `FlowSchematicEditor` / `SandLogisticsSubnetPanel` / `SandLogisticsTables` → barrels, `useMapPageOrchestrator` → `mapPageOrchestrator/*`, `useObjectDetailPanel` → sub-hooks, `setupModifyHandlers` / `setupTranslateHandlers` → submodules. **Pad earthwork (P2+):** `PadEarthworkSketchModal` ~1185→~116 + hooks/tabs, `lib/padEarthworkSketch.ts` → `padEarthworkSketch/*`, `InfraPadEarthworkSection` → hook + form. **CSS:** `index.css` ~9170 строк → `src/styles/` (35 файлов; `features/map/`, `components/app-modal/`; манифест `css-segments.mjs`, `npm run verify:css`). **Lint:** `npm run lint` — **0 errors, 0 warnings**. **UI guidelines** + Cursor rule `.cursor/rules/ui-guidelines.mdc`. Детали: [frontend-structure.md](../architecture/frontend-structure.md), [ui-guidelines.md](../architecture/ui-guidelines.md), [pad-earthwork.md](../features/pad-earthwork/pad-earthwork.md). Тесты: **581/581** Vitest, **16** E2E.

**Рефакторинг backend (compliance P2, июнь 2026):** `fluid_routing`, `line_footprint_attach`, `point_footprint_line_connect` перенесены из `geo/` в `services/`; `import_connection_sync.py`; split `well_trajectory/service.py` (~700→~338 + модули). См. [module-boundaries.md](../architecture/module-boundaries.md), [consistency-review.md](consistency-review.md).

---

## Соответствие FR (выборочно)

### Реализовано

- **FR-1:** регистрация, вход, JWT cookies, refresh rotation, logout, 4 роли, admin users/stats, журнал фоновых задач (`/admin/jobs`), `published` для viewer.
- **FR-2:** слои, объекты, рисование 2D, импорт (CSV, GeoJSON, KML, Shapefile, Spark, API connections), `import_logs`, поиск на карте, пространственный анализ, радиусы, линии POI→external. **Copy/paste группы (2D):** точное сохранение ломаной (`line_preserve_geometry`, привязка концов только к близнецам из выделения) — [map-objects-and-spatial-calculations.md](../features/map/map-objects-and-spatial-calculations.md) §6.1.0. **Производительность карты:** viewport `bbox` + буфер, throttling панорамирования, merge overlay, единый патч full+bbox кэшей, rAF/spatial hit-test/memo MapView, snap-index при рисовании линии, idle-sync слоя, LOD 1:500 000 — §6.1.2; ручной perf checklist — [testing-strategy.md](../testing/testing-strategy.md).
- **FR-4–7:** проекты, POI, 16 ставок, пороги, инженерные параметры, 9 строк анализа матрицы, стоимость, candidates, override.
- **FR-8:** матрица (таблица + карточки), смена eng-параметров, фильтр превышений, мини-карта.
- **FR-10:** иконки, радиусы, линии статусов.
- **FR-11:** CRUD one-pagers, PPTX export, PDF через `window.print()`.
- **Экспорт инфраструктуры:** `/data/export` — Excel/CSV координат, GeoJSON проекта (клиент, [project-export.md](../features/import-export/project-export.md)).
- **Импорт (карточки):** `/data/import` — файлы, API, инклинометрия ([project-import.md](../features/import-export/project-import.md)).

### Частично / упрощённо

| FR | Документ | Факт |
|----|----------|------|
| FR-2.1.2 | OSM / Satellite / Terrain | 2D: подложка **Esri World Imagery**; рельеф — **3D** (MapTiler). Переключателя OSM в 2D нет. |
| FR-2.2.4 | Порядок слоёв | `sort_order` в БД; drag-and-drop в UI нет. |
| FR-11.2.1 | Server PDF | Клиентский print CSS, не WeasyPrint. |
| FR-12.1.2 | i18n | Только русский UI. |
| FR-12.2.2 | Меню | См. таблицу навигации выше. |
| FR-12.3 | Таблицы | По экранам; Excel — выгрузка таблиц **параметров**; **экспорт координат/GeoJSON** — `/data/export`; полный Excel отчёта/матрицы — нет. |

### Не реализовано (MVP / post-MVP)

| FR | Примечание |
|----|------------|
| FR-1.3.1–1.3.3 | Профиль, история, `audit_log` |
| FR-2.4.5 | Якорь `network_node` в `poi_infrastructure_analysis` |
| FR-14.1.1 | Подтверждение email |
| user-flows §1 | Landing, onboarding-тур |

### Legacy (намеренно не в UI)

- `decision_matrices`, TOPSIS/WSM/AHP — FR-14.1.3, FR-14.1.5.

---

## Анализ POI vs объекты карты

**Матрица и стоимость (9 строк):** 4 internal linear + 4 external Point + кустовые площадки — см. [calculation-functions.md](../calculations/calculation-functions.md).

**Карта и импорт:** расширенный справочник подтипов (УКГ/ТСГ, метанол, БКНС, карьер, `gas_pipeline`, …) — [map-objects-and-spatial-calculations.md](../features/map/map-objects-and-spatial-calculations.md) §1.4, код `backend/app/geo/constants.py`.

**Автопоиск ближайшего** (`EXTERNAL_POINT_SUBTYPES`): `gas_processing`, `gtes` (кластер gtes/gpes/vies), `substation`, `refinery`, `ground_pumping_station`, `sand_quarry`.

---

## API (актуальные префиксы)

Базовый URL: `/api/v1`. Полный список — Swagger `/api/v1/docs` и [decision-matrix/README.md](../../decision-matrix/README.md).

Группы: `auth`, `admin`, `admin/jobs` (list, health, cancel), `projects`, `projects/{id}/pois`, `projects/{id}/infrastructure/*` (в т.ч. `.../objects/{id}/pad-earthwork/compute|last|params|sketch|sketch/generate|dem/fetch`, **`.../well-trajectory/*`** incl. **`POST .../import/csv|wbp|witsml`**, **`POST .../import/preview`**, **`POST .../clearance`**, **`GET projects/{id}/well-trajectory/geojson`**, **`POST projects/{id}/well-trajectory/clearance`**), `projects/{id}/map3d-custom-models` (upload / list / PATCH / assign + bulk apply / apply-preview / file), `projects/{id}/pois/{id}/analysis`, `projects/{id}/import/*`, `import/logs`, `projects/{id}/one-pagers`, `projects/{id}/flow-schematic`, `projects/{id}/infrastructure/networks`, `projects/{id}/import_connections`, `projects/{id}/sand-logistics` (GET result, POST analyze), `projects/{id}/pad-earthwork/dem` (501 upload stub).

---

## Тестирование и CI

- Backend: `tests/test_autoroad_network_plan.py` (MST Steiner, `total_new_km` vs legacy chain), `tests/test_autoroad_connect.py`; `test_road_graph.py` (`geodesic_midpoint`); `tests/test_pad_earthwork_api.py` (compute/last/params/sketch/generate, `oil_pad` only); `tests/test_well_trajectory_api.py`, `tests/test_well_trajectory_import.py`, `tests/test_well_trajectory_clearance_coords.py`, `tests/test_well_bottomhole_sync.py`; `pad-earthwork-planner/tests/test_well_layout.py`; `well-trajectory-planner/tests/` (incl. `test_design_horizontal.py`, `test_clearance.py`, `test_import_csv.py`, `test_import_wbp.py`).
- Frontend: `AdminJobsPage.test.tsx` (журнал, пагинация, «Отменить» только для активных задач); `mapFeatureGeometrySync.test.ts` (drag точки/линии, methanol_facility); `npm run verify:css` (каскад после split CSS).
- **E2E (Playwright, 16):** login, projects, parameters, flows, import, **matrix**, **report**, **import-3d**, map (2D, draw autoroad, detail save, ruler), flows-logistics (analyze, timeline). Инфра: `e2e/helpers.ts`, `VITE_E2E_MAP_HOOK` / `__dmOlMap`, автоочистка [`cleanup_e2e_data.py`](../../decision-matrix/backend/scripts/cleanup_e2e_data.py) через `globalTeardown`. Подробнее: [testing-strategy.md](../testing/testing-strategy.md).
- GitHub Actions: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) — lint, unit, coverage gates, job `E2E (Playwright)`.
- Husky / lint-staged в корне — **не** настроены ([development-plan.md](development-plan.md) этап 1).
- Деплой: [DEPLOY.md](../../DEPLOY.md), GitHub Pages + VM workflow.

---

## Связанные документы

| Тема | Файл |
|------|------|
| Требования | [requirements.md](../product/requirements.md) |
| Потоки PFD | [fluid-flow-schematic.md](../features/flows/fluid-flow-schematic.md) |
| 3D-карта | [map-3d-features.md](../features/map/map-3d-features.md) |
| Объекты карты | [map-objects-and-spatial-calculations.md](../features/map/map-objects-and-spatial-calculations.md) |
| Импорт Искра | [spark-import-mapping.md](../features/import-export/spark-import-mapping.md) |
| Земляные работы площадки | [pad-earthwork.md](../features/pad-earthwork/pad-earthwork.md) |
| Траектории скважин (M1 ✅, M2 ✅, M3 ✅) | [well-trajectory.md](../features/well-trajectory/well-trajectory.md), [план реализации](../features/well-trajectory/well-trajectory-implementation-plan.md), [roadmap](../features/well-trajectory/well-trajectory-roadmap.md) |
| Оптимизация размещения кустов | [pad-placement-optimization.md](../features/pad-placement/pad-placement-optimization.md), [plan](../features/pad-placement/pad-placement-optimization-plan.md), [data model](../features/pad-placement/pad-placement-optimization-data-model.md) | ✅ M1–M5 + M2+ |
| План (исторический) | [development-plan.md](development-plan.md) |
| План развития | [system-evolution-plan.md](system-evolution-plan.md) |
