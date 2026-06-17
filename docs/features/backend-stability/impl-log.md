# Журнал реализации: backend-stability

## 2026-06-17 Фаза 1 — Settings
- Статус: завершено
- Файлы: `app/core/config.py`, `requirements.txt` (+tenacity, circuitbreaker)
- Отступления: нет

## 2026-06-17 Фаза 2 — Пул БД + safe startup
- Статус: завершено
- Файлы: `database.py` (NullPool SQLite / QueuePool PG), `startup_checks.py`, `main.py` (alembic advisory lock)
- Тесты: `test_database_pool.py`, `test_startup_checks_strict.py`, `test_alembic_concurrent_lock.py`
- Отступления: StaticPool заменён на NullPool для SQLite — StaticPool ломал FK-тесты из-за общего соединения

## 2026-06-17 Фаза 3a — asyncio.to_thread
- Статус: завершено
- Файлы: `api_common.py` (`run_planner_async`), handlers, `clearance_service.py`, `planner_adapter.py`, `pad_earthwork/service.py`, `pad_placement/compute.py`
- Тесты: `test_run_planner_async.py`
- Отступления: ~~sync `run_planner` сохранён~~ — удалён в loop Reviewer (см. ниже)

## 2026-06-17 Фаза 3b — httpx.AsyncClient
- Статус: завершено
- Файлы: `app/core/http_client.py`, адаптеры well_trajectory/pad_earthwork/dem_store/autoroad, `main.py` lifespan
- Отступления: HTTP-адаптеры сохраняют sync-обёртки через `run_on_main_loop` для вызовов из `to_thread` (контракт async-only для InProcess не применён — меньший diff)

## 2026-06-17 Фаза 4 — Retry / circuit breaker / errors
- Статус: завершено
- Файлы: `microservice_errors.py`, `http_retry.py`, `circuit_breaker.py`, `error_handlers.py`, адаптеры, `frontend/.../client.ts`
- Отступления: OpenTopography без circuit breaker (по плану)

## 2026-06-17 Фаза 5 — Jobs / observability / health / rate limit
- Статус: завершено
- Файлы: `job_queue.py`, `worker/settings.py`, `health_checks.py`, `compute_rate_limit.py`, API routers
- Отступления: `schedule_project_job` удалён (не использовался)

## 2026-06-17 Фаза 6 — Deploy
- Статус: завершено
- Файлы: `Dockerfile` (multi-worker), `deploy/docker-compose.yml` (limits + worker healthcheck), `.env.example`

## 2026-06-17 Reviewer loop 1 — правки контракта
- Статус: завершено
- Файлы:
  - `app/core/compute_rate_limit.py` — русский `detail` + заголовок `Retry-After: 60` (contract §5)
  - `frontend/src/lib/api/client.ts` — дословные строки microservice_* (contract §1.4)
  - `api_common.py`, `api_handlers.py` — удалён неиспользуемый sync `run_planner`
- Отступления: HTTP sync-обёртки адаптеров (impl-log фаза 3b) — без изменений
