# Integration Map: backend-stability

Карта точек правок по всей кодовой базе для Builder'а. Сгруппирована по фазам плана. Стрелки показывают направление зависимости (кто кого вызывает).

## Фаза 1 — Settings (основа)

```
app/core/config.py  ← точка расширения (+20 полей)
    ↓
requirements.txt    ← tenacity>=8.2.0, circuitbreaker>=1.4.0
```

**Файлов затронуто:** 2
**Риски:** нет (только расширение)

---

## Фаза 2 — Пул БД + safe startup

```
app/core/database.py:17                       ← pool params + StaticPool для SQLite
    ↑
app/core/config.py (DB_*)

app/core/startup_checks.py:12-19              ← расширить validate_production_settings
    ↑
app/main.py:70 (lifespan вызов validate_production_settings)
    ↓
app/main.py:43-54 (run_alembic_upgrade)       ← distributed lock + timeout
```

**Файлов затронуто:** 3
**Тесты:** `test_database_pool.py`, `test_startup_checks_strict.py`, `test_alembic_concurrent_lock.py`

---

## Фаза 3 — Async runtime

### 3a — `asyncio.to_thread` для CPU-bound

```
app/services/well_trajectory/api_common.py:55
    ↓ (замена run_planner → run_planner_async)
app/services/well_trajectory/api_design_handlers.py:72,94,116,187
app/services/well_trajectory/api_import_handlers.py:142,182,196

app/services/well_trajectory/clearance_service.py:194   ← to_thread для _run_clearance
    ↑
app/services/well_trajectory/api_clearance_handlers.py:87,124

app/services/pad_earthwork/service.py:395               ← to_thread для adapter.compute
app/services/pad_placement/sf_score.py:44               ← to_thread для score_variant_sf

app/services/autoroad_network/planner_adapter.py
    строка 342 (run_planner_inprocess definition)
    строка 373 (fallback внутри run_planner_http)
    строка 384 (fallback внутри run_planner_http)
    строка 409 (call внутри _compute_network_plan)
```

### 3b — `httpx.AsyncClient` для HTTP

```
app/core/http_client.py                        ← НОВЫЙ: get_http_client() синглтон
    ↑
app/main.py:67-110 (lifespan init/close)

app/services/well_trajectory/trajectory_adapter.py:64-132
    ↑ все 7 методов HttpWellTrajectoryAdapter sync → async
app/services/well_trajectory/trajectory_adapter.py:135-143
    ↑ get_well_trajectory_adapter() — возвращает async-интерфейс
    ↓
app/services/well_trajectory/api_*_handlers.py ← await adapter.method(...)

app/services/pad_earthwork/earthwork_adapter.py:24-35
    ↑ HttpPadEarthworkAdapter.compute sync → async
app/services/pad_earthwork/dem_store.py:112-161
    ↑ fetch_opentopography_dem sync → async
```

### 3c — ProcessPoolExecutor (опционально)

```
app/core/executors.py                          ← НОВЫЙ: cpu_pool синглтон
    ↑
app/main.py:67-110 (lifespan init/shutdown)
    ↓
app/services/autoroad_network/planner_adapter.py (только run_planner_inprocess)
```

**Файлов затронуто (фаза 3):** ~12
**Тесты:** `test_async_to_thread.py`, `test_async_http_adapters.py`

---

## Фаза 4 — Retry, Circuit breaker, обработка ошибок

```
app/core/microservice_errors.py                ← НОВЫЙ: иерархия exceptions
    ↑
app/core/http_retry.py                         ← НОВЫЙ: tenacity декоратор
    ↑
app/core/circuit_breaker.py                    ← НОВЫЙ: circuitbreaker обёртка, 3 синглтона
    ↓
app/core/error_handlers.py                     ← handler для MicroserviceError → 502/503

app/services/autoroad_network/planner_adapter.py:367-384
    ← retry + breaker на run_planner_http
    ← сузить except Exception до httpx.HTTPError + ValidationError

app/services/well_trajectory/trajectory_adapter.py (все 7 методов)
    ← retry + breaker well_trajectory_breaker

app/services/pad_earthwork/earthwork_adapter.py:24-35
    ← retry + breaker pad_earthwork_breaker

app/services/pad_earthwork/dem_store.py:112-161
    ← retry без breaker (внешний API)

# Frontend
decision-matrix/frontend/src/lib/api/client.ts
    ← +3 строки в API_ERROR_MESSAGES_RU
```

**Файлов затронуто:** ~8
**Тесты:** `test_microservice_errors.py`, `test_http_retry.py`, `test_circuit_breaker.py`

---

## Фаза 5 — Job dedup, observability, rate limit, health

### 5a — job_queue дедупликация

```
app/services/job_queue.py:104-121              ← enqueue_project_job: убрать безусловный fire_and_forget
app/services/job_queue.py:124-126              ← удалить мёртвый schedule_project_job
app/core/config.py                             ← JOBS_SYNC_FALLBACK=False default, watchdog+stale tuning
```

### 5b — ARQ worker observability

```
app/worker/settings.py:16-23                   ← on_startup, on_job_start, on_job_end, max_tries, ARQ_MAX_JOBS
    ↑
app/main.py:35-40 (configure_logging)          ← переиспользовать в worker (вынести в reusable import)
```

### 5c — расширенный /health

```
app/core/health_checks.py                      ← НОВЫЙ: check_redis, check_microservices, check_arq_queue
    ↑
app/main.py:160-176 (/health endpoint)         ← расширить ответ
    ↑
app/core/config.py (HEALTH_CHECK_*)
```

### 5d — Rate limit на compute

```
app/core/compute_rate_limit.py                 ← НОВЫЙ: enforce_compute_rate_limit(request)
    ↑
app/api/v1/pad_earthwork.py                    ← Depends на compute-эндпоинтах
app/api/v1/well_trajectory.py                  ← Depends на design/clearance/import
app/api/v1/autoroad_network.py                 ← Depends на compute
app/api/v1/pad_placement.py                    ← Depends на compute
app/api/v1/analysis.py                         ← Depends на analyze-all
app/api/v1/sand_logistics.py                   ← Depends на analyze
app/api/v1/graph.py                            ← Depends на networks/build
app/api/v1/pywellgeo.py                        ← Depends на compute
```

**Файлов затронуто (фаза 5):** ~15
**Тесты:** `test_job_queue_dedup.py`, `test_worker_hooks.py`, `test_health_extended.py`, `test_compute_rate_limit.py`

---

## Фаза 6 — Deploy

```
decision-matrix/backend/Dockerfile:44          ← CMD с ${UVICORN_WORKERS:-1}
    ↑
deploy/docker-compose.yml                      ← deploy.resources.limits, worker healthcheck
    ↑
decision-matrix/backend/.env.example           ← все новые env

DEPLOY.md                                      ← UVICORN_WORKERS, JOBS_SYNC_FALLBACK=false
docs/architecture/architecture.md              ← retry/breaker/health
docs/planning/implementation-status.md         ← новая строка observability
docs/planning/consistency-review.md            ← добавить ревизию
```

**Файлов затронуто:** ~6

---

## Сводная карта по слоям (module-boundaries.md)

| Слой | Новые модули | Изменяемые модули |
|------|--------------|-------------------|
| `app/core/` | `microservice_errors.py`, `http_retry.py`, `circuit_breaker.py`, `http_client.py`, `health_checks.py`, `compute_rate_limit.py`, `executors.py` (опц.) | `config.py`, `database.py`, `startup_checks.py`, `error_handlers.py`, `middleware.py` (без изменений) |
| `app/services/well_trajectory/` | — | `api_common.py`, `trajectory_adapter.py`, `clearance_service.py`, `api_design_handlers.py`, `api_import_handlers.py` |
| `app/services/autoroad_network/` | — | `planner_adapter.py` |
| `app/services/pad_earthwork/` | — | `service.py`, `earthwork_adapter.py`, `dem_store.py` |
| `app/services/pad_placement/` | — | `sf_score.py` |
| `app/services/` (общее) | — | `job_queue.py` |
| `app/worker/` | — | `settings.py` |
| `app/api/v1/` | — | `pad_earthwork.py`, `well_trajectory.py`, `autoroad_network.py`, `pad_placement.py`, `analysis.py`, `sand_logistics.py`, `graph.py`, `pywellgeo.py` |
| `app/main.py` | — | lifespan + `/health` |
| Frontend | — | `lib/api/client.ts` (3 строки) |
| Deploy | — | `Dockerfile`, `docker-compose.yml`, `.env.example` |
| Docs | — | `DEPLOY.md`, `architecture.md`, `implementation-status.md`, `consistency-review.md` |

---

## Проверка границ модулей (для Reviewer)

При ревью проверить соблюдение [module-boundaries.md](../../architecture/module-boundaries.md):

1. **`app/core/*` не зависит от `app/services/*`** — `microservice_errors.py`, `http_retry.py`, `circuit_breaker.py` — чистая инфраструктура, не знают про well_trajectory/autoroad/pad_earthwork.
2. **`http_retry.py` / `circuit_breaker.py`** — конфигурируются через `Settings`, не через хардкод.
3. **Per-microservice circuit breakers** — создаются в `circuit_breaker.py` (синглтоны), не в services.
4. **`health_checks.py`** — читает `Settings`, не импортирует из `services/*` (использует общий `httpx.AsyncClient` из `http_client.py`).
5. **Handler'ы API (`app/api/v1/*`)** — добавляется только `Depends(enforce_compute_rate_limit)`, без бизнес-логики.
6. **Frontend** — только словарь переводов, без новых компонентов/хуков.

---

## Порядок реализации для Builder

Строго последовательно:

1. Фаза 1 → коммит `feat(backend): add stability settings to config`
2. Фаза 2 → коммит `feat(backend): db pool + strict production validation`
3. Фаза 3a → коммит `feat(backend): asyncio.to_thread for CPU-bound ops`
4. Фаза 3b → коммит `feat(backend): async httpx clients for microservices`
5. Фаза 3c (опц.) → коммит `feat(backend): ProcessPool for Steiner tree`
6. Фаза 4 → коммит `feat(backend): retry + circuit breaker + microservice errors`
7. Фаза 5a → коммит `fix(backend): deduplicate job execution in queue`
8. Фаза 5b → коммит `feat(backend): ARQ worker hooks + observability`
9. Фаза 5c → коммит `feat(backend): extended /health with redis and microservices`
10. Фаза 5d → коммит `feat(backend): rate limit on compute endpoints`
11. Фаза 6 → коммит `ops: multi-worker uvicorn + resource limits`

Один PR = одна фаза (или подфаза). Не смешивать фазы в одном коммите.

---

## Зависимости между фазами

```
Фаза 1 (Settings)
    ↓
    ├── Фаза 2 (пул БД, startup)   — использует DB_*, проверяет DEMO_USERS
    ├── Фаза 3 (async runtime)     — использует HTTP_*, требует pool_pre_ping
    ├── Фаза 4 (retry/breaker)     — использует MICROSERVICE_*, требует async-адаптеры фазы 3
    ├── Фаза 5 (observability)     — использует ARQ_*, COMPUTE_*, HEALTH_CHECK_*
    └── Фаза 6 (deploy)            — требует завешённые фазы 2-5 (особенно alembic fix для multi-worker)
```

**Фаза 6 (deploy) нельзя запускать до завершения фазы 2** (race condition в alembic при multi-worker startup).
**Фазу 4 нельзя запускать до фазы 3b** (retry-декоратор применяется к async-методам адаптеров).
