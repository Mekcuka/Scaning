# Статус реализации приложения

> **Назначение:** единая точка согласования документации `docs/` с кодом `decision-matrix/`.  
> **Дата:** май 2026. При изменении продукта обновляйте этот файл и [consistency-review.md](./consistency-review.md).

## Область

| Компонент | Путь | В scope |
|-----------|------|---------|
| СППР (prod) | `decision-matrix/` | да |
| Документация | `docs/` | да |

## Краткий итог

| Категория | Оценка |
|-----------|--------|
| Must Have MVP (FR из [requirements.md](./requirements.md)) | **~85%** |
| Should Have | **~65%** |
| Функции сверх базового ТЗ (3D, PFD, песок, Искра, расширенная карта) | реализованы, описаны в отдельных doc |
| Автотесты | backend `app/` ~72%, frontend `pages/` ~79% ([testing-strategy.md](./testing-strategy.md)) |

---

## Навигация UI (факт)

Боковое меню (`AppLayout.tsx`), видимость по роли — `lib/permissions.ts`:

| Маршрут | Раздел | Роли |
|---------|--------|------|
| `/` | Дашборд | все |
| `/projects` | Проекты | admin, analyst, viewer |
| `/map` | Карта | все |
| `/parameters` | Параметры (вкладки) | admin, analyst, viewer |
| `/parameters/capacity` | Пропускная способность | ↑ |
| `/parameters/sand` | Песок / логистика | ↑ |
| `/parameters/entry-dates` | Даты ввода | ↑ |
| `/parameters/rates` | Ставки (16 показателей) | ↑ |
| `/flows/*` | Потоки (PFD) | admin, analyst, viewer |
| `/matrix` | Матрица | admin, analyst, viewer |
| `/report` | Отчёты (одностраничники) | admin, analyst, viewer |
| `/import` | Импорт | admin, analyst, data_manager |
| `/import-3d` | Импорт 3D (custom GLB) | admin (загрузка); admin + владелец проекта (назначение) |
| `/admin/users`, `/admin/jobs` | Администрирование (пользователи, журнал задач) | admin |

**Отличие от FR-12.2.2:** отдельного пункта «Ставки» нет — ставки внутри **«Параметры»**; добавлены **«Параметры»** и **«Потоки»**. Редирект `/rates` → `/parameters/rates`.

---

## Backend: модули и файлы

| Модуль | API / сервисы | Статус |
|--------|---------------|--------|
| Auth + RBAC | `api/v1/auth.py`, `admin.py`, `admin_jobs.py`, `services/auth_tokens.py`, `project_access.py` | ✅ |
| Фоновые задачи (проект) | `project_jobs.py`, `job_queue.py` (enqueue в `ARQ_QUEUE_NAME`), `project_job_run.py`, worker | ✅ |
| Фоновые задачи (admin) | `api/v1/admin_jobs.py`, `services/admin_jobs.py` | ✅ |
| Проекты, POI, ставки, пороги | `api/v1/router.py`, `services/cost_rates.py`, `calculations.py` | ✅ |
| Карта, слои, объекты | `api/v1/map.py` | ✅ |
| Custom GLB 3D (`project_map3d_models`) | `api/v1/map3d_models.py`, `services/map3d_custom_models.py`, миграции `015`–`016` (`assigned_subtypes[]`); клиент: `map3dCustomGlbFetch.ts` (Bearer на проде) | ✅ |
| Анализ окружения | `services/infrastructure_analysis.py`, `spatial.py` | ✅ |
| Импорт | `services/import_service.py`, `spark_import.py`, `import_connections.py` | ✅ |
| Async import | `schedule_async_import` (фоновые задачи asyncio, **не** Celery) | ✅ |
| Одностраничники | `api/v1/one_pagers.py`, `one_pager_pptx.py` | ✅ |
| Граф сети | `api/v1/graph.py`, `graph_builder.py` | ✅ (визуализация/PFD; якорь `network_node` в анализе POI — post-MVP) |
| Схема потоков | `api/v1/flow.py`, `fluid_flow_schematic.py`, `flow_schematic_merge.py` | ✅ |
| Песок / логистика | `api/v1/sand_logistics.py`, `sand_logistics.py`, `sand_logistics_store.py` | ✅ (результат в БД; схема: timeline, полная топология на любом годе, layout/slice, адаптивные отступы) |
| Экономика потоков | `economic_flow_schematic.py`, `economic_rates.py` | ✅ |
| Автосеть автодорог | `plan_core`: MST всех терминалов, `min(сеть, прямая)`; BFF `autoroad-network/plan|apply`; job `autoroad_connect`; legacy `autoroad-connect` | ✅ |
| Autoroad Network Service (HTTP :8001) | `services/autoroad-network/` | ⬜ опционально (`AUTOROAD_NETWORK_INPROCESS=false`) |
| UI «Построить сеть» | `MapPage` drawMode `autoroad_network`, `AutoroadNetworkPanel`, `lib/autoroadNetwork.ts` | ✅ |

**БД:** SQLite (`run_local.py`) или PostgreSQL + PostGIS (`DATABASE_URL` в `.env`). Geodesic: PostGIS `geography` или haversine fallback.

---

## Frontend: страницы

| Маршрут | Компонент | Статус |
|---------|-----------|--------|
| `/login`, `/register` | `LoginPage`, `RegisterPage` | ✅ |
| `/` | `DashboardPage` | ✅ |
| `/projects`, `/projects/:id` | `ProjectsPage`, `ProjectDetailPage` | ✅ |
| `/map` | `MapPage` + `MapView` (2D) / `MapView3D` | ✅ |
| `/parameters/*` | `ParametersPage`, `SandParametersPage`, … | ✅ |
| `/matrix` | `MatrixPage` | ✅ |
| `/report/*` | `ReportListPage`, `ReportEditorPage`, … | ✅ |
| `/import` | `ImportPage` | ✅ |
| `/import-3d` | `Import3DPage` — custom GLB (admin upload; owner assign) | ✅ |
| `/flows/*` | `FlowTechnologyPage`, … | ✅ |
| `/admin/users` | `AdminLayout` + `AdminUsersPage` | ✅ |
| `/admin/jobs` | `AdminLayout` + `AdminJobsPage` (health, фильтры, отмена только `pending`/`running`, автообновление 3 с) | ✅ |

**Оболочка (`AppLayout`):** выход (иконка `LogOut`) в нижней панели сайдбара; в шапке — тема и выбор проекта. PWA: `public/sw.js` — fallback на `index.html` для deep link (например `/Scaning/admin/jobs` на Pages).

**3D-карта:** `VITE_MAP_3D_ENABLED`, `VITE_MAPTILER_KEY`, `VITE_API_URL` (обязателен на GitHub Pages) — см. [map-3d-features.md](./map-3d-features.md), cross-origin auth — [auth-rbac.md](./auth-rbac.md).

**Панель «Слои» на `/map`:** переключатели подложки, групп подтипов, POI, радиусов — в `localStorage` на проект (`mapLayerPreferences.ts`, ключ `dm-map-layer-prefs:{projectId}`). Видимость импортированных слоёв (`infrastructure_layers.is_visible`) — в БД.

**Загрузка объектов на `/map`:** гибрид полного кэша + bbox при просмотре (порог 80 объектов, буфер 12%, без лишних `GET` при мелком пане); синхронизация full+bbox кэшей при CRUD/геометрии (`mapQueries.ts`); API [`bbox_filter.py`](../decision-matrix/backend/app/geo/bbox_filter.py). **Плавность 2D:** rAF на `pointermove`, spatial hit-test (`mapHitTest.ts`), точечный hover, `React.memo(MapView)`, idle-sync слоя при ≥150 объектах, LOD линий по умолчанию 1:500 000 — §6.1.2 [map-objects-and-spatial-calculations.md](./map-objects-and-spatial-calculations.md). **Drag точек в editMode:** `updateWhileInteracting` + [`mapFeatureGeometrySync.ts`](../decision-matrix/frontend/src/lib/mapFeatureGeometrySync.ts). Кластеризация точек (FR-2.4.3) — не реализована.

---

## Соответствие FR (выборочно)

### Реализовано

- **FR-1:** регистрация, вход, JWT cookies, refresh rotation, logout, 4 роли, admin users/stats, журнал фоновых задач (`/admin/jobs`), `published` для viewer.
- **FR-2:** слои, объекты, рисование 2D, импорт (CSV, GeoJSON, KML, Shapefile, Spark, API connections), `import_logs`, поиск на карте, пространственный анализ, радиусы, линии POI→external. **Copy/paste группы (2D):** точное сохранение ломаной (`line_preserve_geometry`, привязка концов только к близнецам из выделения) — [map-objects-and-spatial-calculations.md](./map-objects-and-spatial-calculations.md) §6.1.0. **Производительность карты:** viewport `bbox` + буфер, throttling панорамирования, merge overlay, единый патч full+bbox кэшей, rAF/spatial hit-test/memo MapView, snap-index при рисовании линии, idle-sync слоя, LOD 1:500 000 — §6.1.2; ручной perf checklist — [testing-strategy.md](./testing-strategy.md).
- **FR-4–7:** проекты, POI, 16 ставок, пороги, инженерные параметры, 9 строк анализа матрицы, стоимость, candidates, override.
- **FR-8:** матрица (таблица + карточки), смена eng-параметров, фильтр превышений, мини-карта.
- **FR-10:** иконки, радиусы, линии статусов.
- **FR-11:** CRUD one-pagers, PPTX export, PDF через `window.print()`.

### Частично / упрощённо

| FR | Документ | Факт |
|----|----------|------|
| FR-2.1.2 | OSM / Satellite / Terrain | 2D: подложка **Esri World Imagery**; рельеф — **3D** (MapTiler). Переключателя OSM в 2D нет. |
| FR-2.2.4 | Порядок слоёв | `sort_order` в БД; drag-and-drop в UI нет. |
| FR-11.2.1 | Server PDF | Клиентский print CSS, не WeasyPrint. |
| FR-12.1.2 | i18n | Только русский UI. |
| FR-12.2.2 | Меню | См. таблицу навигации выше. |
| FR-12.3 | Таблицы | По экранам; Excel — выгрузка таблиц **параметров**, не полного отчёта. |

### Не реализовано (MVP / post-MVP)

| FR | Примечание |
|----|------------|
| FR-1.3.1–1.3.3 | Профиль, история, `audit_log` |
| FR-2.4.3 | Кластеризация точек на карте |
| FR-2.4.5 | Якорь `network_node` в `poi_infrastructure_analysis` |
| FR-14.1.1 | Подтверждение email |
| user-flows §1 | Landing, onboarding-тур |

### Legacy (намеренно не в UI)

- `decision_matrices`, TOPSIS/WSM/AHP — FR-14.1.3, FR-14.1.5.

---

## Анализ POI vs объекты карты

**Матрица и стоимость (9 строк):** 4 internal linear + 4 external Point + кустовые площадки — см. [calculation-functions.md](./calculation-functions.md).

**Карта и импорт:** расширенный справочник подтипов (УКГ/ТСГ, метанол, БКНС, карьер, `gas_pipeline`, …) — [map-objects-and-spatial-calculations.md](./map-objects-and-spatial-calculations.md) §1.4, код `backend/app/geo/constants.py`.

**Автопоиск ближайшего** (`EXTERNAL_POINT_SUBTYPES`): `gas_processing`, `gtes` (кластер gtes/gpes/vies), `substation`, `refinery`, `ground_pumping_station`, `sand_quarry`.

---

## API (актуальные префиксы)

Базовый URL: `/api/v1`. Полный список — Swagger `/api/v1/docs` и [decision-matrix/README.md](../decision-matrix/README.md).

Группы: `auth`, `admin`, `admin/jobs` (list, health, cancel), `projects`, `projects/{id}/pois`, `projects/{id}/infrastructure/*`, `projects/{id}/map3d-custom-models` (upload / list / assign-by-subtype / file), `projects/{id}/pois/{id}/analysis`, `projects/{id}/import/*`, `import/logs`, `projects/{id}/one-pagers`, `projects/{id}/flow-schematic`, `projects/{id}/infrastructure/networks`, `projects/{id}/import_connections`, `projects/{id}/sand-logistics` (GET result, POST analyze).

---

## Тестирование и CI

- Backend: `tests/test_admin_jobs.py` (admin list/cancel/health HTTP), `tests/test_job_queue.py` (очередь `decision-matrix`), `tests/test_project_jobs.py`.
- Frontend: `AdminJobsPage.test.tsx` (журнал, кнопка «Отменить» только для активных задач); `mapFeatureGeometrySync.test.ts` (drag точки/линии, methanol_facility).
- GitHub Actions: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — lint, unit, coverage gates, E2E.
- Husky / lint-staged в корне — **не** настроены ([development-plan.md](./development-plan.md) этап 1).
- Деплой: [DEPLOY.md](../DEPLOY.md), GitHub Pages + VM workflow.

---

## Связанные документы

| Тема | Файл |
|------|------|
| Требования | [requirements.md](./requirements.md) |
| Потоки PFD | [fluid-flow-schematic.md](./fluid-flow-schematic.md) |
| 3D-карта | [map-3d-features.md](./map-3d-features.md) |
| Объекты карты | [map-objects-and-spatial-calculations.md](./map-objects-and-spatial-calculations.md) |
| Импорт Искра | [spark-import-mapping.md](./spark-import-mapping.md) |
| План (исторический) | [development-plan.md](./development-plan.md) |
| План развития | [system-evolution-plan.md](./system-evolution-plan.md) |
