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

Ориентир по **функционалу продукта** (чеклист user-flows, вручную): было ~20–30%, после доработок ~**35–40%**. `MapPage` (~2,7k строк) по-прежнему почти без unit/E2E рисования.

### Объём автотестов

| Слой | До | После |
|------|-----|-------|
| Frontend unit | 154 | **~240** |
| Frontend test-файлов | 42 | **~82** |
| Backend `def test_` | ~120 | **143** |
| E2E Playwright | 1 | **6** |

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

E2E (нужен dev-сервер или `PLAYWRIGHT_BASE_URL`; в CI — job `E2E`):

```powershell
cd decision-matrix/frontend
npm run test:e2e
```

## Принципы «не навредить»

- PR с тестами **без** изменения поведения, кроме точечного `data-testid` и extract pure helpers.
- Перед рефакторингом MapPage/MapView — characterization-тесты на helpers.
- Моки на границе: `vi.mock('../lib/api')`, TestClient + seed users из `tests/conftest.py`.
- Geo/map API — поведение как в CI (PostGIS); unit-сервисы — shared SQLite (`tests/conftest.py`).

## Инфраструктура frontend

- [`vitest.config.ts`](../decision-matrix/frontend/vitest.config.ts) — jsdom, coverage v8, порог `src/lib/**` ≥ 30%, `src/pages/**` ≥ 77%, `MapPage.tsx` ≥ 73% (факт ~78%, цель 80%).
- [`src/test/renderWithProviders.tsx`](../decision-matrix/frontend/src/test/renderWithProviders.tsx) — QueryClient + Router.
- [`src/test/pages/`](../decision-matrix/frontend/src/test/pages/) — `renderPage`, `createApiMock` / [`apiMockModule.ts`](../decision-matrix/frontend/src/test/pages/apiMockModule.ts), [`mapPageHarness.tsx`](../decision-matrix/frontend/src/test/pages/mapPageHarness.tsx).
- [`src/test/fixtures/`](../decision-matrix/frontend/src/test/fixtures/) — проекты, пользователи, infra, map (`map.ts`).
- E2E: [`e2e/`](../decision-matrix/frontend/e2e/) — login, projects, parameters, flows, import, map.

### Pages 80% (план, май 2026)

| Этап | Статус | Покрытие `src/pages` |
|------|--------|----------------------|
| Инфраструктура harness + fixtures | готово | — |
| Auth, report utils, flows, admin | готово | |
| MapPage integration (mock MapView + OL) | готово | MapPage ~76% |
| CI gate `src/pages/**` | **77%** (ступень к 80%) | **~78–79%** |

**MapPage:** `MapPage.integration.test.tsx`, …

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
| §2 Карта / импорт | map3d unit (`map3dCustomGlbFetch`, `map3dGltfLoader`), map API integration, import preview, E2E map load |
| §3 Анализ / проект | environment unit, projects API, E2E create/delete project |
| §4 Потоки / песок | flow/sand API + services, `sandLogisticsFlow`/`sandLogisticsResult` unit, `SandLogisticsSubnetPanel` (timeline), E2E flows tab |
| §5 Отчёты | one_pager API, pptx unit |
| §6 Параметры / ставки | Parameters/Rates smoke, E2E parameters |

## Пороги CI

- **Frontend:** `npm run test` (обязательно); `npm run test:coverage` — пороги v8: `src/lib/**` ≥ 30%, `src/pages/**` ≥ 77%, `MapPage.tsx` ≥ 73%.
- **Backend:** `pytest tests/ -q`; `pytest --cov=app/services --cov-fail-under=25` — soft gate на сервисы.
- **E2E:** отдельный job после frontend build (backend + preview).

См. [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).
