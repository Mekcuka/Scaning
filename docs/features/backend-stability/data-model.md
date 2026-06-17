# Модель данных: backend-stability

Эта фича — **инфраструктурная**, без новой бизнес-сущности. Поэтому «модель данных» здесь = новые настройки `Settings`, новые модули, новые файлы тестов, и изменения в deploy-конфигурации.

## 1. База данных

### Изменения схемы

**Не требуются.** Никаких миграций alembic.

### Новые индексы / ограничения

Не требуются.

---

## 2. Новые модули и файлы

### Backend — новые файлы

| Путь | Назначение | Размер (оценка) |
|------|------------|-----------------|
| `app/core/microservice_errors.py` | Иерархия exception-классов | ~50 строк |
| `app/core/http_retry.py` | Декоратор `retry_on_microservice_failure` на tenacity | ~80 строк |
| `app/core/circuit_breaker.py` | Обёртка над `circuitbreaker`, per-microservice синглтоны | ~70 строк |
| `app/core/http_client.py` | Синглтон `httpx.AsyncClient` + `get_http_client()` | ~50 строк |
| `app/core/health_checks.py` | `check_redis()`, `check_microservices()`, `check_arq_queue()` | ~120 строк |
| `app/core/compute_rate_limit.py` | `enforce_compute_rate_limit(request)` | ~30 строк |
| `app/core/executors.py` | (опц.) `ProcessPoolExecutor` синглтон | ~40 строк |

### Backend — изменяемые файлы (топ-20 по важности)

| Путь | Что меняется | Фаза |
|------|--------------|------|
| `app/core/config.py` | +20 новых `Settings` | 1 |
| `app/core/database.py:17` | параметры пула в `create_async_engine`, `StaticPool` для SQLite | 2 |
| `app/core/startup_checks.py:12-19` | расширить `validate_production_settings` | 2 |
| `app/main.py:43-54` | `run_alembic_upgrade` под distributed lock | 2 |
| `app/main.py:67-110` | lifespan: init http_client, expand health | 2, 5 |
| `app/main.py:160-176` | расширенный `/health` | 5 |
| `app/core/error_handlers.py` | handler для `MicroserviceError` | 4 |
| `app/services/well_trajectory/api_common.py:55` | `run_planner` → `run_planner_async` | 3 |
| `app/services/well_trajectory/trajectory_adapter.py:64-132` | sync → async для 7 методов HTTP-адаптера | 3 |
| `app/services/well_trajectory/clearance_service.py:194` | to_thread обёртка | 3 |
| `app/services/well_trajectory/api_design_handlers.py` | `run_planner(...)` → `await run_planner_async(...)` (несколько мест) | 3 |
| `app/services/well_trajectory/api_import_handlers.py` | то же | 3 |
| `app/services/autoroad_network/planner_adapter.py:342,367-384,409` | to_thread + retry + breaker | 3, 4 |
| `app/services/pad_earthwork/service.py:395` | to_thread для `adapter.compute` | 3 |
| `app/services/pad_earthwork/earthwork_adapter.py:24-35` | sync → async + retry + breaker | 3, 4 |
| `app/services/pad_earthwork/dem_store.py:112-161` | sync → async + retry | 3, 4 |
| `app/services/pad_placement/sf_score.py:44` | to_thread или весь compute в worker | 3 |
| `app/services/job_queue.py:104-121, 124-126` | дедупликация + удаление мёртвого кода | 5 |
| `app/worker/settings.py:16-23` | hooks + `max_jobs` + `max_tries` | 5 |
| `app/api/v1/*.py` | `Depends(enforce_compute_rate_limit)` на compute-эндпоинтах | 5 |

### Frontend — изменяемые файлы

| Путь | Что меняется |
|------|--------------|
| `src/lib/api/client.ts` | +3 строки в `API_ERROR_MESSAGES_RU` |

### Deploy — изменяемые файлы

| Путь | Что меняется |
|------|--------------|
| `decision-matrix/backend/Dockerfile:44` | CMD с интерполяцией `${UVICORN_WORKERS:-1}` |
| `deploy/docker-compose.yml` | `deploy.resources.limits` для api/worker/db/redis, healthcheck worker |
| `decision-matrix/backend/.env.example` | все новые env-переменные |

---

## 3. Новые настройки `Settings` (полный список)

Добавить в `app/core/config.py`:

### Пул БД (фаза 2)

```python
DB_POOL_SIZE: int = 10
DB_MAX_OVERFLOW: int = 20
DB_POOL_PRE_PING: bool = True
DB_POOL_RECYCLE_SECONDS: int = 1800  # 30 мин
DB_POOL_TIMEOUT_SECONDS: float = 30.0
```

### Веб-сервер (фаза 6)

```python
UVICORN_WORKERS: int = 1
```

### Микросервисы — таймауты (фаза 4)

```python
HTTP_CONNECT_TIMEOUT_SECONDS: float = 10.0
HTTP_READ_TIMEOUT_SECONDS: float = 60.0  # было 600 для well_trajectory — критично снизить
```

### Retry / Circuit breaker (фаза 4)

```python
MICROSERVICE_RETRY_MAX_ATTEMPTS: int = 3
MICROSERVICE_RETRY_BASE_BACKOFF_SECONDS: float = 0.5
MICROSERVICE_CIRCUIT_FAILURE_THRESHOLD: int = 5
MICROSERVICE_CIRCUIT_RESET_TIMEOUT_SECONDS: int = 60
```

### Worker / queue (фаза 5)

```python
ARQ_MAX_JOBS: int = 4  # сейчас хардкод в WorkerSettings
# Изменить дефолты существующих:
# JOBS_SYNC_FALLBACK: bool = True → False (только fallback при ошибке)
# JOB_QUEUE_WATCHDOG_SECONDS: int = 15 → 60
# JOB_STALE_RUNNING_SECONDS: int = 660 → 1200 (больше job_timeout=600 + запас)
```

### Health (фаза 5)

```python
HEALTH_CHECK_MICROSERVICES: bool = True
HEALTH_CHECK_TIMEOUT_SECONDS: float = 2.0
```

### Rate limit (фаза 5)

```python
COMPUTE_RATE_LIMIT: str = "30/minute"
```

---

## 4. Зависимости (requirements.txt)

### Добавить

```
tenacity>=8.2.0
circuitbreaker>=1.4.0
```

### Уже есть (используется)

- `httpx>=0.28.0` — `AsyncClient`
- `slowapi>=0.1.9` — rate limit
- `arq>=0.26.0` — worker hooks
- `redis[hiredis]>=5.0.0` — health check
- `sqlalchemy>=2.0.36` — pool

### Не добавлять

- `gunicorn` — uvicorn `--workers` достаточно
- `prometheus-client` — вне scope (только structured logs)
- `structlog` — stdlib `logging` с JSON formatter достаточно (уже есть `LOG_JSON`)

---

## 5. Тесты (минимум 10 новых)

| Путь теста | Что покрывает | Фаза |
|------------|---------------|------|
| `tests/test_database_pool.py` | `pool_pre_ping=True`, `pool_size` из settings, `StaticPool` для SQLite | 2 |
| `tests/test_startup_checks_strict.py` | `DEMO_USERS_ENABLED=true` + prod → `RuntimeError`; `REDIS_URL=""` + prod → warn логируется | 2 |
| `tests/test_alembic_concurrent_lock.py` | два concurrent вызова `run_alembic_upgrade` → только один проходит (mock subprocess) | 2 |
| `tests/test_async_to_thread.py` | `run_planner_async` действительно вызывает `asyncio.to_thread` (mock) | 3 |
| `tests/test_async_http_adapters.py` | `HttpWellTrajectoryAdapter.design_connector` — async, использует общий AsyncClient | 3 |
| `tests/test_microservice_errors.py` | трансформация `httpx.ConnectError` → `MicroserviceUnavailableError` → HTTP 503; `ReadTimeout` → 503 + Retry-After; 5xx → 502 | 4 |
| `tests/test_http_retry.py` | retry на 5xx (3 попытки), no-retry на 4xx, exponential backoff (фиксация времени через mock) | 4 |
| `tests/test_circuit_breaker.py` | открытие после `MICROSERVICE_CIRCUIT_FAILURE_THRESHOLD` ошибок, reset через timeout | 4 |
| `tests/test_job_queue_dedup.py` | ARQ enqueue success → НЕ вызывается `_fire_and_forget(execute_project_job)` (mock) | 5 |
| `tests/test_worker_hooks.py` | `on_job_start`/`on_job_end` логируют с extra-полями (caplog) | 5 |
| `tests/test_health_extended.py` | `/health` возвращает redis, microservices, arq_queue_depth | 5 |
| `tests/test_compute_rate_limit.py` | N+1 запрос возвращает 429 (только при `ENVIRONMENT=production`) | 5 |

---

## 6. Deploy-изменения

### `decision-matrix/backend/Dockerfile` (строка 44)

Было:
```dockerfile
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Стало:
```dockerfile
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${UVICORN_WORKERS:-1}"]
```

`UVICORN_WORKERS` задаётся в `app.env` на VM. Default 1 — обратная совместимость.

### `deploy/docker-compose.yml`

Добавить для каждого сервиса:

```yaml
  api:
    deploy:
      resources:
        limits:
          cpus: "2"
          memory: 2G
        reservations:
          cpus: "500m"

  worker:
    deploy:
      resources:
        limits:
          cpus: "2"
          memory: 2G
    healthcheck:
      test: ["CMD", "python", "-c", "import redis,os; redis.from_url(os.environ['REDIS_URL']).ping()"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

  db:
    deploy:
      resources:
        limits:
          cpus: "1.5"
          memory: 2G

  redis:
    deploy:
      resources:
        limits:
          memory: 512M
```

### `.env.example`

```env
# === Backend stability (новые) ===
UVICORN_WORKERS=1
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
DB_POOL_PRE_PING=true
DB_POOL_RECYCLE_SECONDS=1800
HTTP_CONNECT_TIMEOUT_SECONDS=10
HTTP_READ_TIMEOUT_SECONDS=60
MICROSERVICE_RETRY_MAX_ATTEMPTS=3
MICROSERVICE_CIRCUIT_FAILURE_THRESHOLD=5
MICROSERVICE_CIRCUIT_RESET_TIMEOUT_SECONDS=60
ARQ_MAX_JOBS=4
JOBS_SYNC_FALLBACK=false
JOB_QUEUE_WATCHDOG_SECONDS=60
JOB_STALE_RUNNING_SECONDS=1200
COMPUTE_RATE_LIMIT=30/minute
HEALTH_CHECK_MICROSERVICES=true
```

---

## 7. Совместимость и миграция

### Обратная совместимость

- Все новые `Settings` имеют defaults → существующий `.env` работает без правок
- Новый `JOBS_SYNC_FALLBACK=False` — единственный breaking default для прод-инсталляций без Redis: задачи не пойдут in-process автоматически. Документировать в `DEPLOY.md`.

### Breaking changes

- Старый sync `run_planner` удалён — если есть внешние импортёры (их нет), сломается. Только внутреннее использование.
- `WELL_TRAJECTORY_HTTP_TIMEOUT_SECONDS` (600) заменён на `HTTP_READ_TIMEOUT_SECONDS` (60) — для очень тяжёлых расчётов может потребоваться явное повышение. Документировать.

### Документация для обновления

- `DEPLOY.md` — секция про `UVICORN_WORKERS`, `JOBS_SYNC_FALLBACK=false`, новые env
- `docs/architecture/architecture.md` — раздел про retry/circuit breaker, расширенный `/health`
- `docs/planning/implementation-status.md` — добавить строку в таблицу модулей
- `decision-matrix/backend/.env.example` — обновить
