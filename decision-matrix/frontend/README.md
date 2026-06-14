# Frontend — СППР Нефтегаз

React 19 + TypeScript + Vite. Документация проекта: [`../../docs/README.md`](../../docs/README.md).

**Структура модулей карты и API после рефакторинга:** [`../../docs/architecture/frontend-structure.md`](../../docs/architecture/frontend-structure.md).

## Быстрый старт

```powershell
cd decision-matrix/frontend
npm install
npm run dev
```

Приложение: http://127.0.0.1:5173 (нужен backend на :8000 — см. [`../README.md`](../README.md)).

## Команды

| Команда | Назначение |
|---------|------------|
| `npm run dev` | Dev-сервер + HMR |
| `npm run build` | Production-сборка |
| `npm run test` | Vitest (469 тестов) |
| `npm run test:coverage` | Coverage с порогами в `vitest.config.ts` |
| `npm run test:e2e` | Playwright (12 сценариев, см. ниже) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

## Ключевые точки входа

| Путь | Описание |
|------|----------|
| `src/App.tsx` | Маршруты: `/раздел/{projectId}`, legacy-редиректы, `/admin`, `/projects` |
| `src/lib/projectRoutes.ts` | Построение URL с id проекта в конце пути |
| `src/pages/MapPage.tsx` | Страница `/map/{projectId}` — оркестратор |
| `src/pages/map/` | Layout-компоненты карты (toolbar, canvas, panels) |
| `src/components/MapView.tsx` | 2D-карта (OpenLayers), public API |
| `src/components/mapView/` | Init OL, interactions, reactive hooks |
| `src/components/ObjectDetailPanel.tsx` | Панель деталей объекта |
| `src/hooks/useMap*.ts` | Бизнес-логика карты |
| `src/lib/api.ts` | HTTP-клиент (barrel → `lib/api/`) |

## Тесты карты

```powershell
npm run test -- --run src/pages/MapPage src/components/MapView
```

Harness: `src/test/pages/mapPageHarness.tsx`, fixtures: `src/test/fixtures/map.ts`.

## E2E (Playwright)

Перед прогоном — backend на `:8000` (`python run_local.py` в `backend/`). Playwright поднимает Vite на `:5174` с `VITE_E2E_MAP_HOOK=true`.

```powershell
cd decision-matrix/backend
python run_local.py

cd decision-matrix/frontend
npm run test:e2e
```

После прогона тестовые проекты (`test_*`) и пользователи (`e2e-*`) удаляются автоматически (`e2e/global-teardown.ts` → `backend/scripts/cleanup_e2e_data.py`). Полное описание: [`../../docs/testing/testing-strategy.md`](../../docs/testing/testing-strategy.md).

| Путь | Назначение |
|------|------------|
| `e2e/*.spec.ts` | 7 файлов, 12 тестов |
| `e2e/helpers.ts` | API-сессии, seed карты/логистики, `clickMapLonLat` |
| `playwright.config.ts` | `workers: 1`, порт 5174, `globalTeardown` |

## Переменные окружения

См. `.env.example` — `VITE_API_URL`, `VITE_MAP_3D_ENABLED`, `VITE_MAPTILER_KEY`. Для E2E: `VITE_E2E_MAP_HOOK` (задаётся в `playwright.config.ts`, не в `.env`).
