# План: WebSocket + журнал расчётов

**Дата:** 2026-06-16
**Статус:** ready for Builder

## Цель и границы

### В scope

1. **WebSocket-транспорт** для realtime-обновлений статуса фоновых задач проекта (`pending → running → completed/failed/cancelled` + прогресс).
2. **Журнал расчётов** — пошаговая детализация выполнения задачи в новой таблице `project_job_steps` (step_code, title, status, duration, detail).
3. **Прогресс 0–100%** — запись `job.progress` после каждого шага (поле существует, но сегодня не пишется).
4. **Frontend:** единый `useJobRealtime` hook, заменяющий 3 polling-механизма (с fallback на polling при обрыве WS).
5. **UI:** прогресс-бар + expandable список шагов в `TaskLogPanel`.

### Вне scope (первая версия)

- Уведомления между проектами (WS scoped на один проект).
- Стриминг данных расчёта (только метаданные прогресса, не полезная нагрузка).
- Переписывание всех сервисов расчёта под granular steps — только точечные вставки шагов в ключевых местах.
- Server-Sent Events (выбираем WebSocket для двусторонней связи: отмена через WS).

## Стек

| Компонент | Выбор |
|-----------|-------|
| Транспорт | **WebSocket** через `@app.websocket` FastAPI |
| Auth WS | Bearer JWT через query-param `?token=...` (браузер не позволяет задать заголовки на handshake) |
| Pub/sub мост | **Redis pub/sub** (в prod) + in-memory `asyncio.Queue` (dev fallback, `JOBS_SYNC_FALLBACK`) |
| Хранение шагов | Новая таблица `project_job_steps` (PostgreSQL) |
| Прогресс | `project_jobs.progress Float` (существующее поле, начнём писать) |
| Миграция | Alembic `026_calculation_journal`, `down_revision = "025_footprint_conn_tpl"` |
| Frontend | `useJobRealtime` hook + progress bar в `TaskLogPanel` |

## Эталон интеграции

**НЕ микросервис** — это интеграция в существующий монолит `decision-matrix/backend`. Эталоны:
- **SSE-шаблон** (для формата событий): `app/assistant/chat/sse.py`, `format_sse()`
- **Job-инфраструктура**: `app/services/project_jobs.py`, `project_job_run.py`
- **Zustand store (frontend sink)**: `src/lib/taskLog/store.ts`
- **Frontend hook-паттерн**: `src/hooks/useActiveProjectJob.ts`

## Архитектура

```mermaid
flowchart TB
  subgraph browser [Browser]
    FE["useJobRealtime hook<br/>WebSocket client"]
    Store["taskLog Zustand store"]
    UI["TaskLogPanel<br/>progress bar + steps"]
  end

  subgraph web [FastAPI web процесс]
    WS["/api/v1/projects/:id/jobs/ws<br/>@app.websocket"]
    Hub["JobEventHub<br/>in-memory pub/sub"]
    REST["GET /jobs/:id/steps<br/>REST fallback"]
  end

  subgraph worker [ARQ worker процесс]
    Run["execute_project_job"]
    Step["append_job_step()<br/>новый helper"]
  end

  subgraph redis [(Redis)]
    PubSub["pub/sub channel<br/>job-events:{project_id}"]
  end

  Run --> Step
  Step -->|flush + commit короткая сессия| DB[(project_job_steps)]
  Step -->|publish event| PubSub
  PubSub -->|subscribe| Hub
  Hub -->|broadcast| WS
  WS -->|JSON event| FE
  FE --> Store --> UI
  FE -.->|fallback REST poll| REST
```

**Ключевая идея:** worker-процесс публикует события в Redis pub/sub; web-процесс подписан и транслирует в активные WebSocket-соединения. В dev-режиме (`JOBS_SYNC_FALLBACK=True`) worker и web — один процесс, и мост — in-memory `asyncio.Queue`.

## Фазы

### Фаза 1 — Backend: журнал шагов + модель
- Миграция `026_calculation_journal.py` — таблица `project_job_steps`
- Модель `ProjectJobStep` в `app/models/__init__.py`
- Хелпер `append_job_step(db, job_id, step_code, title, status, detail)` в новом `app/services/job_steps.py`
- REST endpoint `GET /api/v1/projects/{project_id}/jobs/{job_id}/steps`
- Инструментарий: статусные константы `STEP_PENDING/RUNNING/OK/WARN/ERROR/SKIPPED`

### Фаза 2 — Backend: запись шагов в существующих сервисах
- `project_job_run.py`: вставка `append_job_step` в ключевые точки каждого `_run_*` (до/после основных операций)
- Пересчёт `job.progress = completed / total` после каждого шага
- Для каждого `job_type` — свой набор шагов (см. таблицу ниже)

### Фаза 3 — Backend: WebSocket + pub/sub мост
- `app/services/job_events.py` — `JobEventHub` (in-memory dict project_id → set of asyncio.Queue)
- `app/api/v1/jobs_ws.py` — `@app.websocket("/api/v1/projects/{project_id}/jobs/ws")`
- Auth: проверка JWT из `?token=...`, `resolve_project` (read access)
- Redis bridge: `subscribe_job_events()` слушает `job-events:{project_id}`, форвардит в hub
- Worker-side: `publish_job_event(project_id, event)` → Redis `PUBLISH` (или hub в dev)

### Фаза 4 — Frontend: WS-клиент + UI прогресса
- `src/lib/realtime/createJobWebSocket.ts` — фабрика WS-соединения с auth, reconnect, heartbeat
- `src/hooks/useJobRealtime.ts` — единый hook, заменяющий 3 polling-механизма (с fallback)
- `src/lib/taskLog/store.ts` — приём WS-событий в существующий store
- `src/components/TaskLogPanel.tsx` — прогресс-бар + expandable список шагов
- Toast на терминальные статусы через `pushToast`

## Наборы шагов по job_type

| job_type | Шаги (step_code) |
|----------|------------------|
| `poi_analyze_all` | `fetch_pois`, `analyze_per_poi` (N итераций), `persist_results` |
| `pad_earthwork_compute` | `fetch_dem`, `compute_volumes`, `build_mesh`, `persist_properties` |
| `well_trajectory_compute` | `fetch_wells`, `design_trajectories`, `clearance_check`, `persist_json` |
| `sand_logistics_analyze` | `fetch_network`, `build_subnets`, `solve_timeline`, `persist_results` |
| `import_file` | `read_file`, `validate`, `import_records`, `build_connections` |

## Критерии готовности (для Reviewer)

- [ ] Контракт из `contract.md` реализован 1:1
- [ ] Миграция `026` идемпотентна (проверка `insp.get_table_names()`), есть downgrade
- [ ] WebSocket endpoint принимает JWT из query-param, отклоняет без auth
- [ ] WS-события приходят в frontend в realtime (< 500ms от шага до UI)
- [ ] Fallback: при обрыве WS возобновляется polling (существующие 3 механизма остаются как backup)
- [ ] `job.progress` обновляется после каждого шага
- [ ] Таблица `project_job_steps` содержит детализацию для всех 9 job_type
- [ ] Тесты: pytest (backend WS + steps) + npm test (frontend hook + UI)
- [ ] Границы модулей соблюдены (`module-boundaries.md`): `api/v1/*` не делает SQL, `services/*` не лезёт в `Request`
- [ ] heartbeat ping/pong каждые 30s (для proxied окружений, `erascaning.duckdns.org`)
- [ ] E2E: запуск задачи через WS, проверка прогресса и списка шагов

## Риски

1. **Redis pub/sub в prod** — если Redis недоступен, WS продолжает работать на in-memory (но только для одного процесса). Митигация: heartbeat + fallback на polling.
2. **Множественные вкладки** — каждое WS-соединение = подписчик; `JobEventHub` должен держать set очередей на project_id.
3. **Proxy buffering** — `erascaning.duckdns.org` за nginx; нужен `proxy_read_timeout` + heartbeat.
4. **Auth на WS** — нельзя задать Authorization header; используем query-param (компромисс: токен в URL логах). Альтернатива — Sec-WebSocket-Protocol subprotocol.
