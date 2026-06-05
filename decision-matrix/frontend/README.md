# Frontend — СППР Нефтегаз

React 19 + TypeScript + Vite. Документация проекта: [`../../docs/README.md`](../../docs/README.md).

**Структура модулей карты и API после рефакторинга:** [`../../docs/frontend-structure.md`](../../docs/frontend-structure.md).

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
| `npm run test:e2e` | Playwright |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

## Ключевые точки входа

| Путь | Описание |
|------|----------|
| `src/pages/MapPage.tsx` | Страница `/map` — оркестратор |
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

## Переменные окружения

См. `.env.example` — `VITE_API_URL`, `VITE_MAP_3D_ENABLED`, `VITE_MAPTILER_KEY`.
