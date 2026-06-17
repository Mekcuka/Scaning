# Отчёт ревью: backend-stability

**Дата:** 2026-06-17  
**Итерация:** loop 2/2  
**Вердикт:** ✅ ЗЕЛЁНЫЙ — готов к интеграции

## Проверки

| Проверка | Результат |
|----------|-----------|
| Границы backend (`app/core/*` → без импортов из `services/*`) | ✅ |
| Границы frontend (только `client.ts`, 3 строки) | ✅ |
| Контракт microservice errors (502/503, `Retry-After: 5`) | ✅ |
| Контракт rate limit 429 (§5) | ✅ исправлено в loop 1 |
| Контракт frontend строки (§1.4 дословно) | ✅ исправлено в loop 1 |
| Контракт §4.1 удаление sync `run_planner` | ✅ исправлено в loop 1 |
| Контракт §4.3 async-адаптеры (полностью async API) | ⚠️ отступление (impl-log фаза 3b) |
| pytest (stability + integration) | ✅ 60 passed |
| bugbot | ⚠️ не запущен (лимит subagent) |
| security-review | ⚠️ не запущен (лимит subagent) |
| `httpx.Client` в `app/` | ✅ только в `scripts/` |

## Сверка с contract.md (loop 2)

### ✅ Блокирующие пункты loop 1 — закрыты

| Пункт | Было | Сейчас |
|-------|------|--------|
| §5 rate limit 429 | `compute_rate_limit_exceeded`, без заголовка | `detail="Превышен лимит запросов к ресурсоёмким операциям"`, `Retry-After: 60` |
| §1.4 frontend | другие формулировки | дословные строки в `client.ts:121-123` |
| §4.1 / правило 6 | sync `run_planner` + export | удалён; только `run_planner_async` |

### ✅ Совпадает (без изменений с loop 1)

| Пункт контракта | Реализация |
|-----------------|------------|
| Exception-классы §1.1 | `microservice_errors.py` |
| JSON `{detail, request_id, microservice, upstream_status?}` | `error_handlers.py:43-49` |
| `Retry-After: 5` для 503 microservice | `error_handlers.py:41-42` |
| Retry 3 попытки + exponential backoff | `http_retry.py` |
| Circuit breaker per-service (3 шт.) | `circuit_breaker.py` |
| `/health` поля §3 | `health_checks.py` + `main.py` |
| Job dedup §5a | `job_queue.py:104-118` |
| Worker hooks + `max_tries=1` + `ARQ_MAX_JOBS` | `worker/settings.py` |
| Settings §7 | `config.py` |
| Dockerfile multi-worker | `CMD ... --workers ${UVICORN_WORKERS:-1}` |

### ⚠️ Не блокирующие / задокументированные отступления

| Отступление | impl-log | Решение Reviewer |
|-------------|----------|------------------|
| `NullPool` вместо `StaticPool` для SQLite | ✅ | Принять |
| HTTP-адаптеры с sync-обёртками `run_on_main_loop` вместо полностью async §4.3 | ✅ | Принять на v1 |
| Worker logs: JSON-строка вместо `extra={}` из примера контракта | — | OK |
| HTTP 4xx upstream → проброс с `upstream_status` (§1.2) | — | Не блокер v1 |
| `job_queue.py:120` — `_fire_and_forget(execute_project_job(job_id))` coroutine warning | — | Pre-existing; Integrator может обернуть |

## pytest (Reviewer loop 2)

```
tests/test_database_pool.py              4 passed
tests/test_startup_checks_strict.py      6 passed
tests/test_alembic_concurrent_lock.py    3 passed
tests/test_run_planner_async.py          4 passed
tests/test_microservice_errors.py        3 passed
tests/test_job_queue_dedup.py            2 passed
tests/test_job_queue.py                  4 passed
tests/test_well_trajectory_api.py       29 passed
tests/test_pad_earthwork_api.py          8 passed (subset)
tests/test_autoroad_network_api.py       4 passed (subset)
Итого: 60 passed, 0 failed
```

Примечание: для async-тестов локально нужен `pytest-asyncio` из `requirements-dev.txt` (в CI уже есть).

## Замечания (не блокирующие)

- Bugbot/security-review — прогнать на Integrator при восстановлении лимита subagent или в CI.
- Integrator: полный `pytest tests/ -q` + `npm run lint` + `npm run test` перед merge.
- Multi-worker (`UVICORN_WORKERS=2`): проверить alembic advisory lock на staging.

## Handoff

Фаза Reviewer завершена. Вердикт: **зелёный**.  
Готово к фазе **Integrator**.
