# Стратегия тестирования

> Пользовательские потоки: [user-flows.md](./user-flows.md)  
> Статус функционала и маршруты UI: [implementation-status.md](./implementation-status.md)

## Пирамида

1. **Unit** — чистая логика в `frontend/src/lib`, `backend/app/services`, `backend/app/geo`.
2. **Integration** — FastAPI `TestClient`, React smoke с `renderWithProviders` и моком `api`.
3. **E2E** — Playwright: критические сценарии (auth, проекты, параметры, потоки, импорт, карта).

## Покрытие кода (строки, Vitest v8 / pytest-cov)

### Сравнение до и после расширения тестов (май 2026)

| Область | До | После | Δ |
|--------|-----|-------|---|
| **Frontend `src` (всё)** | 16,5% | **25,5%** | +9,0 п.п. |
| `frontend/src/lib` | 34,4% | **36,7%** | +2,3 п.п. |
| `frontend/src/lib/map3d` | 54,1% | **54,6%** | +0,5 п.п. |
| `frontend/src/pages` | 4,3% | **~79%** (цель 80%) | +~75 п.п. |
| `frontend/src/components` | 6,6% | **15,2%** | +8,6 п.п. |
| `frontend/src/hooks` | 2/7 файлов с тестами | **65,7%** строк | — |
| **Backend `app/`** | не замерялось | **72%** | — |
| **Backend `app/services/`** | частично unit | **68%** | — |

Ориентир по **функционалу продукта** (чеклист user-flows, вручную): было ~20–30%, после доработок ~**35–40%**. `MapPage` после рефакторинга (~**981** строка оркестратора + модули в `pages/map/`, `hooks/`) — integration/mock-тесты покрывают workflows; unit/E2E рисования на OL — по-прежнему ограничены.

### Объём автотестов

| Слой | До | После |
|------|-----|-------|
| Frontend unit | 154 | **~240** |
| Frontend test-файлов | 42 | **~82** |
| Backend `def test_` | ~120 | **143** |
| E2E Playwright | 1 | **12** |

### Текущий baseline (для следующих сравнений)

| Область | Строки |
|---------|--------|
| `frontend/src` (всё) | **25,5%** |
| `frontend/src/lib` | **36,7%** |
| `frontend/src/lib/map3d` | **54,6%** |
| `frontend/src/pages` | **~79%** |
| `frontend/src/pages/MapPage.tsx` | **~76%** (цель 80%) |
| `frontend/src/components` | **15,2%** |
| `frontend/src/hooks` | **65,7%** |
| Backend `app/` | **72%** |
| Backend `app/services/` | **68%** |

## Локальный запуск

```powershell
cd decision-matrix/frontend
npm run test
npm run test:coverage

cd decision-matrix/backend
pip install -r requirements.txt -r requirements-dev.txt
pytest tests/ -q
pytest tests/ --cov=app --cov-report=term-missing
```

E2E (backend на `:8000`, Playwright поднимает Vite на `:5174` с `VITE_E2E_MAP_HOOK=true`; в CI — job `E2E`):

```powershell
cd decision-matrix/backend
python run_local.py

cd decision-matrix/frontend
npm run test:e2e
```

Перед прогоном остановите лишние процессы на порту 8000 (иначе rate-limit и CSRF могут флапать). В `development`/`test` лимитер auth отключён (`app/main.py`).

### E2E сценарии (12)

| Файл | Сценарий |
|------|----------|
| `login.spec.ts` | страница входа |
| `projects.spec.ts` | создать проект → карта; удаление с confirm |
| `parameters.spec.ts` | вкладка пропускной способности |
| `flows.spec.ts` | раздел «Потоки» |
| `flows-logistics.spec.ts` | логистика песка: загрузка, analyze, timeline |
| `import.spec.ts` | страница импорта |
| `map.spec.ts` | 2D-карта; автодорога (seed точек + «Готово»); detail PATCH; линейка |

### Инфраструктура E2E

| Компонент | Путь | Назначение |
|-----------|------|------------|
| Конфиг | [`playwright.config.ts`](../decision-matrix/frontend/playwright.config.ts) | `workers: 1`, dev на `:5174`, `globalTeardown` |
| Хелперы | [`e2e/helpers.ts`](../decision-matrix/frontend/e2e/helpers.ts) | `setupE2eSession`, `loginViaApi`, `createProject`, `clickMapLonLat`, `seedSandLogisticsNetwork` |
| Teardown | [`e2e/global-teardown.ts`](../decision-matrix/frontend/e2e/global-teardown.ts) | вызов скрипта очистки после прогона |
| Очистка БД | [`scripts/cleanup_e2e_data.py`](../decision-matrix/backend/scripts/cleanup_e2e_data.py) | cascade-delete проектов `test_*` и тестовых пользователей |
| Map hook | [`setupViewHandlers.ts`](../decision-matrix/frontend/src/components/mapView/setupViewHandlers.ts) | `window.__dmOlMap` при `VITE_E2E_MAP_HOOK=true` |

**Локально:** backend через `run_local.py` пишет в SQLite `data/sppr.db`; Playwright поднимает Vite на `:5174` (отдельный порт от dev `:5173`, чтобы не смешивать `localStorage`). Один процесс на `:8000` — иначе возможны 429/CSRF-флапы.

**CI (job `E2E`):** отдельная БД `data/e2e.db`, `vite preview` на `:5173`, `VITE_E2E_MAP_HOOK=true` при сборке, `E2E_DATABASE_URL` при teardown.

**Автоочистка:** после каждого `npm run test:e2e` (включая падения) `globalTeardown` запускает `cleanup_e2e_data.py`. Удаляются проекты `test_*` и пользователи `e2e-*` / `*@test.ru`; демо-аккаунты (`engineer@oilgas.ru` и др.) не трогаются.

| Переменная | Локально | CI |
|------------|----------|-----|
| `PLAYWRIGHT_BASE_URL` | `http://127.0.0.1:5174` | `http://127.0.0.1:5173` |
| `E2E_DATABASE_URL` | `sqlite+aiosqlite:///./data/sppr.db` (default) | `sqlite+aiosqlite:///./data/e2e.db` |
| `VITE_E2E_MAP_HOOK` | `true` (через `webServer.env`) | `true` (build env) |

Ручная очистка:

```powershell
cd decision-matrix/backend
python scripts/cleanup_e2e_data.py
# другая БД:
$env:DATABASE_URL = "sqlite+aiosqlite:///./data/e2e.db"
python scripts/cleanup_e2e_data.py
```

**Карта в E2E:** клики по lon/lat — `clickMapLonLat` → `__dmOlMap.getPixelFromCoordinate`. Рисование линии: seed двух `gas_processing` через API, `fitMapToAllObjects`, завершение кнопкой **«Готово»** (не dblclick). CSRF — `CsrfHolder` + ротация из заголовков ответа.

## Карта 2D — ручной perf checklist

Зафиксировать **до/после** изменений производительности на одном тяжёлом проекте (≥200 объектов в viewport, режим просмотра с bbox при ≥80 объектах). Инструменты: Chrome **Performance** (FPS, Long Tasks >50 ms, `getImageData` / hit-test) и **React Profiler** (число commits).

| # | Сценарий (10 с) | Что смотреть |
|---|-----------------|-------------|
| 1 | Панорамирование | FPS, Long Tasks; число `GET …/objects?bbox=` (должно не расти на мелком пане) |
| 2 | Hover без инструментов | commits `MapPage`; время в hit-test; предупреждения `willReadFrequently` |
| 3 | Рисование линии (edit, draft ≥1 вершина) | commits/с при движении мыши; отзывчивость preview |
| 4 | Drag одной точки (edit) | длительность синхронизации слоя; «залипание» курсора |
| 5 | Один zoom step + pan | LOD переключение; артефакты линий при быстром пане |

Критерий успеха оптимизаций pointermove: заметно меньше React commits в сценарии 2; после spatial hit-test — почти нет canvas readback в Performance.

## Принципы «не навредить»

- PR с тестами **без** изменения поведения, кроме точечного `data-testid` и extract pure helpers.
- Рефакторинг MapPage/MapView (июнь 2026) завершён — см. [frontend-structure.md](./frontend-structure.md); перед изменениями — characterization-тесты на helpers и прогон `MapPage.*` / `MapView`.
- Моки на границе: `vi.mock('../lib/api')`, TestClient + seed users из `tests/conftest.py`.
- Geo/map API — поведение как в CI (PostGIS); unit-сервисы — shared SQLite (`tests/conftest.py`).

## Инфраструктура frontend

- [`vitest.config.ts`](../decision-matrix/frontend/vitest.config.ts) — jsdom, coverage v8, порог `src/lib/**` ≥ 30%, `src/pages/**` ≥ 77%, `MapPage.tsx` ≥ 73% (факт ~78%, цель 80%).
- [`src/test/renderWithProviders.tsx`](../decision-matrix/frontend/src/test/renderWithProviders.tsx) — QueryClient + Router.
- [`src/test/pages/`](../decision-matrix/frontend/src/test/pages/) — `renderPage`, `createApiMock` / [`apiMockModule.ts`](../decision-matrix/frontend/src/test/pages/apiMockModule.ts), [`mapPageHarness.tsx`](../decision-matrix/frontend/src/test/pages/mapPageHarness.tsx).
- [`src/test/fixtures/`](../decision-matrix/frontend/src/test/fixtures/) — проекты, пользователи, infra, map (`map.ts`).
- E2E: [`e2e/`](../decision-matrix/frontend/e2e/) — 7 spec-файлов, 12 тестов; `helpers.ts`, `global-teardown.ts`; автоочистка `cleanup_e2e_data.py`.

### Pages 80% (план, май 2026)

| Этап | Статус | Покрытие `src/pages` |
|------|--------|----------------------|
| Инфраструктура harness + fixtures | готово | — |
| Auth, report utils, flows, admin | готово | |
| Admin jobs (`test_admin_jobs.py`, `AdminJobsPage.test.tsx`) | готово | |
| Job queue (`test_job_queue.py`, имя очереди ARQ) | готово | |
| MapPage integration (mock MapView + OL) | готово | MapPage ~76% |
| CI gate `src/pages/**` | **77%** (ступень к 80%) | **~78–79%** |

**MapPage:** `MapPage.integration.test.tsx`, …

**Карта (unit, bbox/кэш):** [`mapBboxUtils.test.ts`](../decision-matrix/frontend/src/lib/mapBboxUtils.test.ts) (буфер bbox, merge viewport+overlay), [`mapQueries.test.ts`](../decision-matrix/frontend/src/lib/mapQueries.test.ts) (upsert/remove во full и bbox-кэше), [`mapFeatureGeometrySync.test.ts`](../decision-matrix/frontend/src/lib/mapFeatureGeometrySync.test.ts) (синхронизация inner-feature при drag, `updateWhileInteracting` policy).

**Логистика песка (frontend unit):** `sandLogisticsFlow.test.ts` (layout/slice, geo-ordering, adaptive spacing), `sandLogisticsResult.test.ts` (`resolveSubnetForSchematicAtView`, slice cache), `sandLogisticsSchematicTimeline.test.ts`, `SandLogisticsSubnetPanel.test.tsx` (смена года без remount схемы), `FlowLogisticsPage.test.tsx`.

Шаблон API-мока:

```typescript
vi.mock('../lib/api', async (importOriginal) => {
  const { createApiMock } = await import('../test/pages/apiMockModule');
  return createApiMock(importOriginal);
});
```

## Инфраструктура backend

- [`tests/conftest.py`](../decision-matrix/backend/tests/conftest.py) — client, login, CSRF, shared DB, rate limit off.
- [`tests/factories.py`](../decision-matrix/backend/tests/factories.py) — `create_test_project`, layer, POI.
- [`pytest.ini`](../decision-matrix/backend/pytest.ini) — `test_demo_users` исключён из default run.

### Новые integration-тесты (API smoke)

| Файл | Что покрывает |
|------|----------------|
| `test_projects_api.py` | GET/PATCH/DELETE project |
| `test_project_delete.py` | cascade delete |
| `test_map_api_crud.py` | layer, point, line objects |
| `test_flow_api.py` | flow-schematic, economic-flow |
| `test_sand_api.py` | sand-logistics analyze + GET result persist |
| `test_sand_logistics_store.py` | store helpers / row_to_response |
| `test_sand_logistics_horizon*.py` | годовая симуляция, display subnets |
| `test_graph_api.py` | networks build/list |
| `test_import_geojson.py` | import preview |
| `test_import_service_rows.py` | `import_rows_to_layer` |
| `test_flow_schematic_store.py` | save/load schematic |
| `test_graph_builder.py` | build network from line |

## Чеклист функционала (ручная отметка раз в квартал)

| § user-flows | Автотесты |
|--------------|-----------|
| §1 Регистрация / вход | E2E login + register flow, backend `test_auth_rbac` |
| §2 Карта / импорт | map3d unit, map API integration, import preview, E2E map (load, draw line, detail save, ruler) |
| §3 Анализ / проект | environment unit, projects API, E2E create/delete project |
| §4 Потоки / песок | flow/sand API + services, `sandLogisticsFlow`/`sandLogisticsResult` unit, `SandLogisticsSubnetPanel` (timeline), E2E flows tab |
| §5 Отчёты | one_pager API, pptx unit |
| §6 Параметры / ставки | Parameters/Rates smoke, E2E parameters |

## Пороги CI

- **Frontend:** `npm run test` (обязательно); `npm run test:coverage` — пороги v8: `src/lib/**` ≥ 30%, `src/pages/**` ≥ 77%, `MapPage.tsx` ≥ 73%.
- **Backend:** `pytest tests/ -q`; `pytest --cov=app/services --cov-fail-under=25` — soft gate на сервисы.
- **E2E:** job `E2E (Playwright)` — backend `e2e.db`, `vite preview`, 12 сценариев, `globalTeardown` + `E2E_DATABASE_URL`.

См. [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).
