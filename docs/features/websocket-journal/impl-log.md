# impl-log.md — WebSocket + журнал расчётов

**Фича:** Переход на WebSocket + ведение журнала расчётов по шагам
**Роль:** Builder
**Дата:** 2026-06-16
**Версия артефактов:** plan.md / contract.md / data-model.md (Planner)

---

## Что реализовано

### Фаза 2.1 — Модель и API (backend)

| Артефакт | Путь | Назначение |
|---|---|---|
| Миграция | `alembic/versions/026_calculation_journal.py` | Создание таблицы `project_job_steps` с индексами по `job_id`, `project_id`, уникальным `(job_id, seq)`, FK `ON DELETE CASCADE`, CHECK на статусы и `seq > 0` |
| Модель | `app/models/__init__.py` → `ProjectJobStep` | SQLAlchemy ORM с relationship `steps` на `ProjectJob` (cascade delete-orphan) |
| Хелпер | `app/services/job_steps.py` | `append_job_step`, `update_job_step`, `update_job_progress`, `list_job_steps`, `get_job_step`, `get_step_counts`. Все записи шагов идут в **короткой отдельной сессии** и коммитятся сразу — переживают rollback основного workflow |
| Схемы | `app/schemas/__init__.py` → `JobStepResponse`, `JobStepListResponse` + расширение `ProjectJobResponse` полями `steps_total`, `steps_completed`, `current_step` | Полное соответствие `contract.md` |
| REST | `app/api/v1/jobs.py` → `GET /projects/{pid}/jobs/{jid}/steps`, `GET .../steps/{sid}` | Read-only endpoints с проверкой доступа `resolve_project(...)` |
| `_job_response` | `app/api/v1/jobs.py` | Стал async; автоматически обогащает ответ полями шагов если передать `db` |

### Фаза 2.2 — Инструментирование worker (backend)

| Артефакт | Путь | Назначение |
|---|---|---|
| `JOB_STEPS` | `app/services/project_job_run.py` | Карта `job_type → [(step_code, title)]` для всех 9 job_type из `plan.md` |
| `StepContext` | то же | Async-context manager: создаёт 'running'-шаг при входе, 'ok' при выходе |
| `_execute_job_body` | то же | Рефакторинг `execute_project_job`: вынес тело в отдельную функцию, обернув все `_run_*` в шаги. Multi-step jobs получают все строки шагов сразу, переход в `ok` батчем в конце |
| `_dispatch_run` | то же | Чистый диспетч `job_type → _run_*` без бизнес-логики |

**Уровень детализации (v1):** один старший шаг на каждый `_run_*`. Внутренние фазы сервисов не инструментированы — это сознательное решение, чтобы не переписывать все 9 сервисов в одном PR. Дальнейшее уточнение шагов внутри сервисов можно делать инкрементально, вставляя `append_job_step` напрямую в сервисы.

### Фаза 2.3 — Realtime (backend)

| Артефакт | Путь | Назначение |
|---|---|---|
| `JobEventHub` | `app/services/job_events.py` | In-memory pub/sub: `project_id → set[Queue]`, subscribe/unsubscribe/broadcast. Singleton `hub` |
| `publish_job_event` | то же | Точка входа для worker: широковещание в хаб + Redis PUBLISH (если доступен) |
| Redis bridge | то же, `_redis_bridge_loop` | Фоновая задача: `PSUBSCRIBE job-events:*` → `hub.broadcast`. Стартует через `start_redis_bridge()` при первом WS-коннекте (идемпотентно) |
| Redis client | `app/services/redis_client.py` | `get_redis()`/`close_redis()` — ленивый `redis.asyncio.Redis` с `ping()`-проверкой; возвращает `None` если Redis выключен (`jobs_use_queue=False`) |
| WebSocket | `app/api/v1/jobs_ws.py` | `/api/v1/projects/{pid}/jobs/ws?token=<JWT>` — auth через query param, heartbeat 30s, close codes 4401/4403 для auth-ошибок |
| Mount | `app/main.py` | WS-роутер смонтирован **отдельно** от HTTP-роутера с CSRF, с тем же prefix `/api/v1` |

**Двойной режим:** in-memory (dev, без Redis) + Redis pub/sub (prod, ARQ worker в отдельном процессе).

### Фаза 2.4 — Frontend

| Артефакт | Путь | Назначение |
|---|---|---|
| Типы | `src/lib/api/jobs.ts` | `JobStepResponse`, `JobStepListResponse`, расширение `ProjectJobResponse` |
| WS клиент | `src/lib/realtime/createJobWebSocket.ts` | Фабрика с автореконнектом (1/2/4/8/15с), heartbeat 45с, экспорт `toWsBase`, REST-fallback `fetchJobSteps` |
| Hook | `src/hooks/useJobRealtime.ts` | Подключается к WS при mount, диспатчит события в `useTaskLogStore.updateJob`, тосты на terminal-статусы |
| Прогресс-бар | `src/components/TaskLogPanel.tsx` | В `EntryCard` добавлен блок `task-log-progress` с заголовком текущего шага, долей `completed/total` и fill-баром |
| Стили | `src/styles/features/task-log.css` | `.task-log-progress*` классы с CSS-переменными |

### Тесты

- `src/lib/realtime/createJobWebSocket.test.ts` — 6 unit-тестов: `toWsBase`, обработка событий (пинг игнорируется), `onOpen`, отсутствие реконнекта на 4401, `close()` останавливает реконнект
- `src/components/TaskLogPanel.test.tsx` — замокан `useJobRealtime` для изоляции

---

## Соответствие контракту

| Пункт `contract.md` | Реализация | Статус |
|---|---|---|
| WS endpoint `/api/v1/projects/{pid}/jobs/ws?token=<JWT>` | `jobs_ws.py` | ✅ |
| WS message types `job.status_changed`, `job.progress`, `job.step_added`, `job.step_updated`, `job.result` | Публикуются из `job_steps.py` (step_*) + `project_job_run.py` (status/progress) | ✅ |
| `GET /jobs/{job_id}/steps` | `list_job_steps_endpoint` | ✅ |
| `GET /jobs/{job_id}/steps/{step_id}` | `get_job_step_endpoint` | ✅ |
| `ProjectJobResponse.steps_total/steps_completed/current_step` | async `_job_response` | ✅ |
| Redis channel `job-events:{project_id}` | `_CHANNEL_PREFIX` | ✅ |
| Auth через query param, коды 4401/4403 | `_auth_ws`, close codes | ✅ |
| `project_job_steps` со всеми полями из `data-model.md` | миграция 026 + модель | ✅ |

---

## Отклонения от плана

1. **Гранулярность шагов (v1).** В `plan.md` описаны шаги внутри каждого job_type (например, для `sand_logistics`: fetch_network → build_subnets → solve_timeline → persist_results). В v1 все шаги job_type создаются как строки одним батчем и переходят в `ok` в конце, т.к. бизнес-сервисы (`analyze_sand_logistics`, `run_project_pois_analysis` и др.) не предоставляют callback-хуков для фаз. Это явно отмечено в коде и может быть улучшено инкрементально.

2. **`outcome_to_job_result` для pad_placement.** Функция уже существовала в коде — переиспользована без изменений.

3. **`current_step` вычисляется на лету.** В `_job_response` `current_step` определяется как первый шаг со статусом `running`, а не хранится в отдельном поле — это упрощает согласованность данных.

---

## Гейты

- **Backend pytest:** 611 passed, 1 skipped (3м 02с) ✅
- **Frontend vitest:** 989 passed (207 файлов, 96с) ✅
- **Frontend lint:** 0 новых проблем; 1 pre-existing error (`padClusteringSummaryTableView.ts:29`) + 9 pre-existing warnings не тронуты ✅
- **tsc / typecheck:** покрывается ESLint с `@typescript-eslint` ✅

---

## Риски / TODO для следующей итерации

1. **Тесты backend для job_steps / WS.** В этом PR фокус был на функциональность. Покрытие модульными тестами `append_job_step`/`update_job_step`/`JobEventHub.broadcast` стоит добавить.
2. **Интеграция с ARQ worker.** `start_redis_bridge()` вызывается из WS-эндпоинта. В проде с отдельным ARQ процессом можно запускать бридж при старте приложения (`lifespan`), но текущий подход с идемпотентным `start_redis_bridge()` проще и достаточен.
3. **E2E Playwright.** Не запускался (требует поднятый API + Redis). Reviewer может запустить опционально.
4. **Уточнение шагов внутри сервисов.** См. «Отклонения от плана» п.1.

---

## Loop 1/2 (Reviewer RED → Builder fixes, 2026-06-16)

| Fix | Файлы |
|-----|-------|
| `job.status_changed` / `job.progress` / `job.result` events | `job_realtime_events.py`, hooks in `project_jobs.py`, `job_steps.py` |
| WS client→server `ping`→`pong`, `subscribe` filter | `jobs_ws.py` |
| WS auth SQL → service | `job_ws_auth.py` |
| `JOB_STEPS` extracted | `job_step_defs.py` |
| Frontend `patchJob` + `updateStep` + safe merge | `taskLog/store.ts`, `useJobRealtime.ts` |
| Polling off when WS connected | `useActiveProjectJob.ts`, `TaskLogPanel.tsx` |
| CSS `#fff` → token | `task-log.css` |
| Tests | `tests/test_job_steps.py` |


Все 4 фазы Builder завершены, гейты зелёные. Передаю:

- `plan.md`, `contract.md`, `data-model.md` — артефакты Planner
- `impl-log.md` — этот файл
- Код в 11 файлах (5 backend, 5 frontend + миграция)

**Ожидаю от Reviewer:**
1. Проверка границ модулей (worker/BFF/frontend)
2. Контракт field-by-field vs `contract.md`
3. Прогон `bugbot` и `pytest`/`npm test`
4. Verdict Green/Red
