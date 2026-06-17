# План: стабильность и производительность backend

**Дата:** 2026-06-17
**Статус:** ready for Builder
**Тип:** инфраструктурный рефакторинг (затрагивает >15 файлов)
**Эталон интеграции:** `app/services/well_trajectory/service.py:316` (единственный корректный `asyncio.to_thread`)

## Цель и границы

### В scope

Устранение 10 проблем, выявленных в аудите backend (см. чат с [Анализ архитектуры](<audit-chat>) и explore-сабажентами):

1. CPU-bound операции в async-контексте блокируют event loop
2. Синхронный `httpx.Client` в async-коде
3. Отсутствие конфигурации пула соединений БД
4. Дублирование выполнения задач в `job_queue.py`
5. Нет retry/circuit breaker для HTTP-вызовов к микросервисам
6. Один uvicorn worker + нет resource limits
7. Unsafe дефолты + блокирующий alembic в lifespan
8. Нет observability для ARQ worker
9. Нет трансформации ошибок микросервисов (502/503)
10. Нет rate limit на тяжёлые compute-эндпоинты

### Вне scope

- Замена ARQ на Celery
- Введение Prometheus/StatsD (только structured logs)
- SSO/LDAP, audit_log, multi-tenant
- Кэширование Redis для hot endpoints
- Изменения в frontend (кроме понимания новых кодов ошибок API)
- Object storage (S3) для GLB
- OpenTelemetry tracing

## Стек

| Компонент | Текущий выбор | Изменение |
|-----------|---------------|-----------|
| Веб-сервер | uvicorn (1 worker) | uvicorn `--workers N` через env |
| Пул БД | SQLAlchemy default | `QueuePool` с `pool_pre_ping`, `pool_recycle` |
| HTTP retry | нет | `tenacity>=8.2.0` |
| Circuit breaker | нет | `circuitbreaker>=1.4.0` |
| CPU offload | `asyncio.to_thread` (1 место) | `asyncio.to_thread` везде + общий `ProcessPoolExecutor` для Steiner |
| HTTP client | `httpx.Client` per-request | общий `httpx.AsyncClient` через lifespan |
| Worker hooks | нет | `on_job_start`/`on_job_end` + structured logs |
| Rate limit | slowapi на auth | slowapi на compute-эндпоинты |

## Фазы (последовательные, для Builder)

### Фаза 1 — Конфигурация и Settings (основа)

**Цель:** расширить `Settings` всеми новыми параметрами, чтобы后续 фазы могли их использовать.

**Файлы:**
- `decision-matrix/backend/app/core/config.py` — добавить ~20 новых настроек (см. data-model.md §3)
- `decision-matrix/backend/requirements.txt` — добавить `tenacity>=8.2.0`, `circuitbreaker>=1.4.0`

**Новые настройки:**
```
DB_POOL_SIZE, DB_MAX_OVERFLOW, DB_POOL_PRE_PING, DB_POOL_RECYCLE_SECONDS, DB_POOL_TIMEOUT_SECONDS
UVICORN_WORKERS
ARQ_MAX_JOBS, JOB_QUEUE_WATCHDOG_SECONDS (увеличить default), JOB_STALE_RUNNING_SECONDS (увеличить)
HTTP_CONNECT_TIMEOUT_SECONDS, HTTP_READ_TIMEOUT_SECONDS (универсальные для микросервисов)
MICROSERVICE_RETRY_MAX_ATTEMPTS, MICROSERVICE_RETRY_BACKOFF_SECONDS, MICROSERVICE_CIRCUIT_FAILURE_THRESHOLD
COMPUTE_RATE_LIMIT (строка slowapi)
HEALTH_CHECK_MICROSERVICES (bool)
```

**Критерий готовности фазы 1:** `pytest tests/ -q` зелёный, новые настройки visible в `Settings()` с defaults, не ломают существующий `.env.example`.

---

### Фаза 2 — Пул БД и safe startup (P0 стабильности)

**Цель:** настроить connection pool и ужесточить production-валидацию.

**Файлы:**
- `app/core/database.py` — параметры пула в `create_async_engine`, `StaticPool` для SQLite
- `app/core/startup_checks.py` — расширить `validate_production_settings`:
  - `DEMO_USERS_ENABLED=true` в prod → `raise RuntimeError`
  - `ALLOW_REGISTRATION=true` в prod → `raise RuntimeError` (или warn по решению команды)
  - `REDIS_URL=""` в prod → warn
- `app/main.py` — `run_alembic_upgrade` вынести в отдельную функцию с distributed lock (`pg_try_advisory_lock`) или вообще в standalone скрипт (см. integration map)

**Критерий готовности фазы 2:**
- После `docker compose restart db` первый запрос не падает с ConnectionResetError
- `ENVIRONMENT=production` + `DEMO_USERS_ENABLED=true` блокирует старт
- Миграции не гоняются при multi-worker startup

---

### Фаза 3 — Async runtime: to_thread и AsyncClient (P0 блокировки event loop)

**Цель:** устранить блокировку event loop тяжёлыми операциями.

**Подфаза 3a — `asyncio.to_thread` для CPU-bound:**

**Файлы (центральная точка):**
- `app/services/well_trajectory/api_common.py:55` — переделать `run_planner` в `async def run_planner_async(...)` с `await asyncio.to_thread(fn, ...)`. Это покроет все хендлеры `api_design_handlers.py` и `api_import_handlers.py`.
- `app/services/well_trajectory/clearance_service.py:194` — `_run_clearance` обернуть в `to_thread`
- `app/services/pad_earthwork/service.py:395` — `adapter.compute(req)` обернуть в `to_thread`
- `app/services/pad_placement/sf_score.py:44` — `score_variant_sf` (CPU внутри цикла) либо весь pad_placement compute в to_thread
- `app/services/autoroad_network/planner_adapter.py:342,373,384,409` — `run_planner_inprocess` обернуть в `to_thread` (особенно Steiner tree)

**Подфаза 3b — `httpx.AsyncClient` для HTTP:**

**Новый модуль:** `app/core/http_client.py`
```python
# Синглтон httpx.AsyncClient на процесс, инициализируется в lifespan
async def get_http_client() -> httpx.AsyncClient: ...
```

**Файлы (переделка адаптеров):**
- `app/services/well_trajectory/trajectory_adapter.py` — `HttpWellTrajectoryAdapter`: 7 методов sync → async, использовать общий `httpx.AsyncClient`
- `app/services/pad_earthwork/earthwork_adapter.py` — `HttpPadEarthworkAdapter.compute` sync → async
- `app/services/pad_earthwork/dem_store.py:132` — `fetch_opentopography_dem` sync → async
- `app/main.py:lifespan` — инициализация/закрытие `app.state.http_client`

**Подфаза 3c — `ProcessPoolExecutor` (опционально, после профилирования):**
- Только для Steiner tree (`run_planner_inprocess`) — если измерения покажут, что ThreadPool не помогает из-за GIL
- `app/core/executors.py` — синглтон пула, инициализация в lifespan

**Критерий готовности фазы 3:**
- При запуске `POST /pad-earthwork/compute` одновременно с `GET /health`: p95 `/health` < 100мс (замер в тесте)
- При 5 параллельных `POST /well-trajectory/design`: ни один не падает по таймауту
- В логах нет `httpx.Client` (только `AsyncClient`)

---

### Фаза 4 — Retry, Circuit Breaker, обработка ошибок

**Цель:** корректная обработка сбоев микросервисов.

**Новые модули:**
- `app/core/microservice_errors.py` — иерархия exception:
  ```python
  class MicroserviceError(Exception): ...  # base
  class MicroserviceUnavailableError(MicroserviceError): ...  # ConnectError → 503
  class MicroserviceTimeoutError(MicroserviceError): ...  # ReadTimeout → 503 + Retry-After
  class MicroserviceResponseError(MicroserviceError): ...  # 5xx от микросервиса → 502
  ```
- `app/core/http_retry.py` — декоратор на tenacity:
  - `retry_on_microservice_failure`: 3 попытки, exponential backoff `0.5с → 1с → 2с` + jitter
  - retry только для `ConnectError`/`ReadTimeout`/HTTP 5xx; НЕ retry для 4xx
- `app/core/circuit_breaker.py` — обёртка над `circuitbreaker.CircuitBreaker`:
  - failure threshold = `MICROSERVICE_CIRCUIT_FAILURE_THRESHOLD` (5 ошибок подряд)
  - reset timeout = 60с
  - per-microservice: отдельные breakers для autoroad, well-trajectory, pad-earthwork

**Файлы (применение):**
- `app/services/autoroad_network/planner_adapter.py:367-384` — обернуть `run_planner_http` в retry+breaker, сузить `except Exception` до конкретных httpx-ошибок
- `app/services/well_trajectory/trajectory_adapter.py` — обернуть все 7 методов
- `app/services/pad_earthwork/earthwork_adapter.py` — обернуть `compute`
- `app/services/pad_earthwork/dem_store.py:112-161` — обернуть `fetch_opentopography_dem` (retry, без breaker)
- `app/core/error_handlers.py` — добавить handler для `MicroserviceError` → JSON 502/503 с `Retry-After` заголовком

**Фронтенд-контракт:** новые коды ошибок в `detail`:
- `"microservice_unavailable"` → HTTP 503
- `"microservice_timeout"` → HTTP 503 + `Retry-After: 5`
- `"microservice_error"` → HTTP 502

В `decision-matrix/frontend/src/lib/api/client.ts` → `API_ERROR_MESSAGES_RU` добавить переводы (3 строки).

**Критерий готовности фазы 4:**
- При недоступности микросервиса пользователь видит понятное сообщение (не "Internal server error")
- 3 последовательных сбоя микросервиса → circuit breaker открывается, следующие запросы мгновенно возвращают 503 без ожидания timeout
- Логи содержат структурированные поля: `microservice`, `attempt`, `circuit_state`

---

### Фаза 5 — Дедупликация job_queue, observability, rate limit

**Цель:** устранить двойное выполнение, добавить observability, защитить compute.

**Подфаза 5a — `job_queue.py`:**
- `app/services/job_queue.py:104-121` — `enqueue_project_job`:
  - Если ARQ enqueue успешен → НЕ запускать `_fire_and_forget(execute_project_job(...))`, только watchdog
  - `_fire_and_forget` только если ARQ enqueue упал И `JOBS_SYNC_FALLBACK=true`
  - Удалить мёртвый код `schedule_project_job` (строки 124-126) — не вызывается нигде
- Согласовать таймауты: `JOB_STALE_RUNNING_SECONDS` > `job_timeout` (worker) + 200с запас
- `app/core/config.py` — `JOBS_SYNC_FALLBACK: bool = False` (новый дефолт, был True)

**Подфаза 5b — ARQ worker observability:**
- `app/worker/settings.py`:
  - Добавить `on_startup` → вызывать `configure_logging()` (переиспользовать из main.py)
  - `on_job_start(ctx, job_id)` → structured log: `{"event":"job_start","job_id":..,"project_id":..}`
  - `on_job_end(ctx, job_id, result, duration)` → structured log с duration и status
  - `max_jobs = settings.ARQ_MAX_JOBS` (из Settings)
  - `max_tries = 1` (без авто-retry ARQ, своя retry-логика внутри execute_project_job)

**Подфаза 5c — `/health` расширение:**
- Новый модуль `app/core/health_checks.py`:
  - `check_redis()` — ping через `get_redis()` или redis.asyncio
  - `check_arq_queue()` — `LLEN arq:{queue}` через redis
  - `check_microservices()` — параллельные ping (timeout 2с) к активным HTTP-микросервисам
- `app/main.py:160-176` — расширить `/health`:
  ```json
  {
    "status": "ok|degraded",
    "database": "ok|error",
    "redis": "ok|error|disabled",
    "arq_queue_depth": N,
    "microservices": {"autoroad": "ok|error|inprocess|disabled", ...},
    "environment": "...",
    "alembic_head": "..."
  }
  ```

**Подфаза 5d — Rate limit на compute:**
- Новый модуль `app/core/compute_rate_limit.py`:
  ```python
  def enforce_compute_rate_limit(request: Request) -> None:
      # Аналог enforce_chat_rate_limit, использует COMPUTE_RATE_LIMIT из settings
  ```
- Применить через `Depends(enforce_compute_rate_limit)` на compute-эндпоинт (список см. integration-map.md)
- Альтернатива (если slowapi позволяет): декоратор `@limiter.limit(settings.COMPUTE_RATE_LIMIT)` с добавлением `request: Request`

**Критерий готовности фазы 5:**
- При запросе статуса job в API и одновременном выполнении в worker — в логах одна запись о выполнении, не две
- `/health` возвращает redis status и microservices status
- При 11-м compute-запросе в минуту с одного IP возвращается 429
- Логи worker процесса в JSON формате (как в API)

---

### Фаза 6 — Deploy: uvicorn workers, resource limits

**Цель:** утилизировать multi-core VM и ограничить ресурсы.

**Файлы:**
- `decision-matrix/backend/Dockerfile:44`:
  ```dockerfile
  CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${UVICORN_WORKERS:-1}"]
  ```
  (shell form для интерполяции env)
- `deploy/docker-compose.yml`:
  - Для `api`: `deploy.resources.limits.cpus: "2", memory: 2G`, `reservations: cpus: 500m`
  - Для `worker`: то же + `healthcheck` (через redis-cli ping или кастомный скрипт)
  - Для `redis`: limits memory 512M
  - Для `db`: limits cpus 1.5, memory 2G
- `decision-matrix/backend/.env.example` — добавить новые переменные с комментариями

**Важно (pre-condition):** эта фаза только ПОСЛЕ фазы 2 (alembic fix) и фазы 3 (to_thread fix) — иначе multi-worker сломает старт и усилит блокировки.

**Критерий готовности фазы 6:**
- `docker compose up` создаёт api с `--workers 2` (или более, по env)
- `docker stats` показывает ограничения для api/worker/db
- Worker healthcheck в `docker compose ps` отображается

---

## Критерии готовности (общие для Reviewer)

- [ ] Все 6 фаз реализованы последовательно
- [ ] `pytest tests/ -q` зелёный, добавлено ≥10 новых тестов (см. ниже)
- [ ] `npm run lint && npm run test` зелёный (3 новых кода ошибок в клиенте)
- [ ] Границы модулей соблюдены — вся retry/breaker логика в `app/core/`, не в services
- [ ] Контракт ошибок из contract.md реализован 1:1
- [ ] Несовместимых миграций БД нет (новые только настройки)
- [ ] `.env.example` обновлён всеми новыми переменными
- [ ] `DEPLOY.md` и `docs/architecture/architecture.md` обновлены
- [ ] `docs/planning/implementation-status.md` обновлён (новый модуль observability)
- [ ] E2E не регрессировали (запуск `npm run test:e2e` для map/auth/import)

## Новые тесты (минимум)

| Файл | Что проверяет |
|------|---------------|
| `tests/test_database_pool.py` | pool_pre_ping=True, pool_size из settings |
| `tests/test_startup_checks.py` | DEMO_USERS + prod → RuntimeError |
| `tests/test_microservice_errors.py` | трансформация httpx → MicroserviceError → 502/503 |
| `tests/test_http_retry.py` | retry на 5xx, no-retry на 4xx, exponential backoff |
| `tests/test_circuit_breaker.py` | открытие после N failures, reset после timeout |
| `tests/test_job_queue_dedup.py` | ARQ success → нет дублирующего fire_and_forget |
| `tests/test_health_extended.py` | redis, microservices, arq_queue_depth в ответе |
| `tests/test_compute_rate_limit.py` | 429 после превышения COMPUTE_RATE_LIMIT |
| `tests/test_worker_hooks.py` | on_job_start/end логи в JSON формате |
| `tests/test_alembic_lock.py` | concurrent alembic upgrade → только один runner |

## Риски и митигация

| Риск | Митигация |
|------|-----------|
| Multi-worker ломает `_arq_pool`/`_background_tasks` глобалы | Глобалы per-process — нормально для uvicorn workers |
| ProcessPoolExecutor ломает pickling `pywellgeo` dispatch | Не использовать ProcessPool для pywellgeo; только to_thread |
| Changing `JOBS_SYNC_FALLBACK` ломает dev без Redis | Env-переменная в `.env.example`: dev=`true`, prod=`false` |
| Circuit breaker открывается при deploy микросервиса | Reset timeout 60с + health check после deploy |
| Existing tests падают из-за new rate limits | Rate limit отключён в non-prod (уже сейчас) |

## Связанные документы

- [contract.md](contract.md) — контракт ошибок и API
- [data-model.md](data-model.md) — новые настройки, файлы, тесты
- [integration-map.md](integration-map.md) — точки правок по файлам
- [docs/planning/system-evolution-plan.md](../../planning/system-evolution-plan.md) — Horizon 0/1
- [docs/architecture/module-boundaries.md](../../architecture/module-boundaries.md) — границы слоёв
