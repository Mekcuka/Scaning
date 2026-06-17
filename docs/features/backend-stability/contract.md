# Контракт: backend-stability

Контракт описывает **публичные интерфейсы**, которые Builder реализует дословно. Имена полей, типы, HTTP-коды — финальные.

## 1. Контракт ошибок микросервисов

### 1.1. Новые exception-классы

Модуль `app/core/microservice_errors.py`:

```python
class MicroserviceError(Exception):
    """Base для всех ошибок взаимодействия с микросервисом."""
    status_code: int = 502
    error_code: str = "microservice_error"

class MicroserviceUnavailableError(MicroserviceError):
    """Микросервис не отвечает (ConnectError, ConnectionRefused)."""
    status_code: int = 503
    error_code: str = "microservice_unavailable"

class MicroserviceTimeoutError(MicroserviceError):
    """Микросервис превысил read/connect timeout."""
    status_code: int = 503
    error_code: str = "microservice_timeout"

class MicroserviceResponseError(MicroserviceError):
    """Микросервис вернул HTTP 5xx."""
    status_code: int = 502
    error_code: str = "microservice_error"
```

### 1.2. HTTP-ответы

Все ошибки микросервисов возвращают JSON в существующем формате `{ detail, request_id }` + заголовок `Retry-After` для 503:

**ConnectError / ConnectionRefused:**
```http
HTTP/1.1 503 Service Unavailable
Retry-After: 5

{
  "detail": "microservice_unavailable",
  "request_id": "uuid",
  "microservice": "well-trajectory"
}
```

**ReadTimeout / ConnectTimeout:**
```http
HTTP/1.1 503 Service Unavailable
Retry-After: 5

{
  "detail": "microservice_timeout",
  "request_id": "uuid",
  "microservice": "well-trajectory"
}
```

**HTTP 5xx от микросервиса:**
```http
HTTP/1.1 502 Bad Gateway

{
  "detail": "microservice_error",
  "request_id": "uuid",
  "microservice": "well-trajectory",
  "upstream_status": 500
}
```

**HTTP 4xx от микросервиса (пробрасывается как есть, без retry):**
```http
HTTP/1.1 400 Bad Request

{
  "detail": "<upstream detail string>",
  "request_id": "uuid",
  "microservice": "well-trajectory",
  "upstream_status": 400
}
```

### 1.3. Handler в `app/core/error_handlers.py`

```python
@app.exception_handler(MicroserviceError)
async def microservice_error_handler(request: Request, exc: MicroserviceError):
    request_id = getattr(request.state, "request_id", None)
    headers = {}
    if exc.status_code == 503:
        headers["Retry-After"] = "5"
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.error_code,
            "request_id": request_id,
            "microservice": getattr(exc, "microservice_name", None),
            "upstream_status": getattr(exc, "upstream_status", None),
        },
        headers=headers,
    )
```

### 1.4. Frontend — `decision-matrix/frontend/src/lib/api/client.ts`

Добавить в `API_ERROR_MESSAGES_RU` (дословные строки):

```typescript
microservice_unavailable: "Сервис расчёта временно недоступен. Попробуйте позже.",
microservice_timeout: "Сервис расчёта не ответил за отведённое время. Попробуйте позже.",
microservice_error: "Ошибка сервиса расчёта. Обратитесь к администратору.",
```

Функция `formatApiError(detail, fallback)` уже умеет сопоставлять строки из `detail` с этим словарём — правки только в словаре.

---

## 2. Контракт retry / circuit breaker

### 2.1. Декоратор `app/core/http_retry.py`

```python
def retry_on_microservice_failure(
    *,
    max_attempts: int = 3,
    base_backoff_seconds: float = 0.5,
    max_backoff_seconds: float = 8.0,
    service_name: str = "unknown",
):
    """Декоратор для async-функций, возвращающих httpx.Response или бросающих httpx-ошибки.

    Retry на: httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout, HTTP 5xx.
    No retry на: httpx.HTTPStatusError 4xx, ValidationError, любая другая ошибка.
    """
```

Поведение:
- **Попытка 1:** сразу
- **Попытка 2:** через `base_backoff_seconds * 2^0 + jitter` (0.5с + 0–0.5с)
- **Попытка 3:** через `base_backoff_seconds * 2^1 + jitter` (1с + 0–1с)
- **После max_attempts:** проброс последней ошибки как `MicroserviceResponseError`/`MicroserviceTimeoutError`/`MicroserviceUnavailableError`

### 2.2. Circuit breaker `app/core/circuit_breaker.py`

```python
# Per-microservice синглтоны (3 шт.)
autoroad_breaker = CircuitBreaker(failure_threshold=5, reset_timeout_seconds=60, name="autoroad")
well_trajectory_breaker = CircuitBreaker(failure_threshold=5, reset_timeout_seconds=60, name="well-trajectory")
pad_earthwork_breaker = CircuitBreaker(failure_threshold=5, reset_timeout_seconds=60, name="pad-earthwork")
```

Поведение:
- **CLOSED:** запросы идут; каждый `MicroserviceError` увеличивает счётчик
- **OPEN после 5 ошибок подряд:** все запросы сразу возвращают `MicroserviceUnavailableError` без HTTP-вызова; логируется `circuit_opened`
- **HALF-OPEN после 60с:** один тестовый запрос; успех → CLOSED, fail → снова OPEN
- **Storage:** in-memory (per-process); для uvicorn multi-worker каждый worker имеет свой breaker (приемлемо, т.к. reset 60с)

---

## 3. Контракт расширенного `/health`

### Запрос
```http
GET /health
```

### Ответ 200 (если всё ок):
```json
{
  "status": "ok",
  "database": "ok",
  "redis": "ok",
  "arq_queue_depth": 3,
  "microservices": {
    "autoroad-network": "inprocess",
    "well-trajectory": "ok",
    "pad-earthwork": "disabled"
  },
  "environment": "production",
  "alembic_head": "abc123"
}
```

### Ответ 200 (degraded):
```json
{
  "status": "degraded",
  "database": "ok",
  "redis": "error",
  "arq_queue_depth": null,
  "microservices": {
    "autoroad-network": "error",
    "well-trajectory": "ok",
    "pad-earthwork": "inprocess"
  },
  "environment": "production",
  "alembic_head": "abc123"
}
```

### Значения полей microservices

| Значение | Когда |
|----------|-------|
| `"ok"` | HTTP-микросервис ответил на ping за 2с |
| `"error"` | HTTP-микросервис не ответил / вернул 5xx |
| `"inprocess"` | `*_INPROCESS=true` и `*_SERVICE_URL=""` (без HTTP-пинга) |
| `"disabled"` | `*_INPROCESS=false` и `*_SERVICE_URL=""` |

### Значения redis

| Значение | Когда |
|----------|-------|
| `"ok"` | ping успешен |
| `"error"` | ping упал |
| `"disabled"` | `REDIS_URL=""` (jobs в in-process режиме) |

### `arq_queue_depth`

- Число задач в очереди `arq:{queue_name}` через Redis `LLEN`
- `null` если Redis недоступен

---

## 4. Контракт `asyncio.to_thread` обёрток

### 4.1. `app/services/well_trajectory/api_common.py`

```python
# Было:
def run_planner(fn: Any, /, *args: Any, **kwargs: Any) -> Any: ...

# Стало:
async def run_planner_async(fn: Any, /, *args: Any, **kwargs: Any) -> Any:
    """Вызывает sync fn в thread pool, пробрасывает MicroserviceError."""
```

Старый sync `run_planner` удалён. Все вызовы в `api_design_handlers.py`, `api_import_handlers.py` заменены на `await run_planner_async(...)`.

### 4.2. Адаптеры microservices — async

```python
# Было (HttpWellTrajectoryAdapter):
def design_connector(self, request: ConnectorDesignRequest) -> ConnectorDesignResponse: ...

# Стало:
async def design_connector(self, request: ConnectorDesignRequest) -> ConnectorDesignResponse: ...
```

Все 7 методов `HttpWellTrajectoryAdapter`, `HttpPadEarthworkAdapter.compute`, `fetch_opentopography_dem` — async.

`InProcessWellTrajectoryAdapter` методы становятся async-обёртками:
```python
async def design_connector(self, request: ConnectorDesignRequest) -> ConnectorDesignResponse:
    return await asyncio.to_thread(super-sync-impl, request)
```

### 4.3. `get_well_trajectory_adapter()` → async

Возвращаемые интерфейсы — оба async. Вызывающий код (`api_*_handlers.py`) работает через `await adapter.method(...)`.

---

## 5. Контракт rate limit на compute

### Эндпоинты под rate limit

Все compute-эндпоинты получают rate limit `COMPUTE_RATE_LIMIT` (default `"30/minute"`):

- `POST /projects/{id}/infrastructure/objects/{oid}/pad-earthwork/compute`
- `POST /projects/{id}/infrastructure/objects/{oid}/well-trajectory/*` (design, design-all, design-from-bottomholes, compute, generate-from-layout, clearance, import/*)
- `POST /projects/{id}/well-trajectory/clearance`
- `POST /projects/{id}/autoroad-network/compute`
- `POST /projects/{id}/infrastructure/networks/build`
- `POST /projects/{id}/pad-placement/compute`
- `POST /projects/{id}/pois/analyze-all`
- `POST /projects/{id}/sand-logistics/analyze`
- `POST /projects/{id}/infrastructure/objects/{oid}/pywellgeo/compute`

### Применение

Через `Depends(enforce_compute_rate_limit)` в сигнатуре эндпоинта (аналог `enforce_chat_rate_limit`):

```python
@router.post("/{project_id}/.../compute")
async def compute(
    request: Request,  # нужно для slowapi
    _rl: None = Depends(enforce_compute_rate_limit),
    ...
):
```

### Поведение 429

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{
  "detail": "Превышен лимит запросов к ресурсоёмким операциям",
  "request_id": "uuid"
}
```

Вне production (`ENVIRONMENT != "production"`) rate limit отключён (поведение `enforce_chat_rate_limit` сохранено).

---

## 6. Контракт worker hooks

`app/worker/settings.py`:

```python
async def on_startup(ctx):
    configure_logging()  # JSON в проде

async def on_job_start(ctx, job_id: str):
    logger.info("job_start", extra={"job_id": job_id, "event": "job_start"})

async def on_job_end(ctx, job_id: str, result, duration: float):
    status = "ok" if result is not None else "failed"
    logger.info("job_end", extra={"job_id": job_id, "event": "job_end", "duration_s": duration, "status": status})

class WorkerSettings:
    on_startup = on_startup
    on_job_start = on_job_start
    on_job_end = on_job_end
    max_jobs = settings.ARQ_MAX_JOBS
    max_tries = 1  # без авто-retry ARQ
    job_timeout = 600
    ...
```

---

## 7. Контракт `Settings` (новые поля)

Все новые поля — в `app/core/config.py` с заданными дефолтами (значения в data-model.md §3). Builder реализует их дословно.

**Контракт именования:** все новые настройки — `UPPER_SNAKE_CASE`, как существующие. Префиксы по домену:
- `DB_*` — пул БД
- `MICROSERVICE_*` — retry/breaker
- `HTTP_*` — таймауты
- `COMPUTE_*` — rate limit
- `ARQ_*` / `JOB_*` — worker/queue

---

## Контрактные правила для Builder

1. **Имена файлов новые модулей — дословно** из этого контракта.
2. **HTTP-коды — дословно**: 502 для upstream 5xx, 503 для timeout/connect, 429 для rate limit.
3. **Заголовок `Retry-After: 5`** обязателен для всех 503 ответов.
4. **Коды ошибок в `detail`** — строки из §1.1 `error_code` (snake_case).
5. **Поле `microservice` в ответе** — одно из: `"autoroad-network"`, `"well-trajectory"`, `"pad-earthwork"`, `"opentopography"`.
6. **Старые sync-адаптеры и `run_planner` удаляются**, не сохраняются как deprecated.
7. **Frontend правки минимальны**: только 3 строки в `API_ERROR_MESSAGES_RU`, без новых компонентов.
