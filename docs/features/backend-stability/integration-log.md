# Integration log: backend-stability

**Дата:** 2026-06-17  
**Роль:** Integrator  
**Review verdict:** GREEN (loop 2)

## 4.1 Миграция БД

**Не требовалась** — `data-model.md` §1: «Никаких миграций alembic».

## 4.2 job_type

**Не применимо** — фича не добавляет новый `job_type`. Job dedup и worker hooks — изменения в существующем ARQ pipeline.

## 4.3 Docker / compose

| Артефакт | Статус | Примечание |
|----------|--------|------------|
| `decision-matrix/backend/Dockerfile` | ✅ | `CMD ... --workers ${UVICORN_WORKERS:-1}` |
| `deploy/docker-compose.yml` (api) | ✅ | healthcheck `/health`, limits 2 CPU / 2G RAM |
| `deploy/docker-compose.yml` (worker) | ✅ | healthcheck Redis ping, limits 2 CPU / 2G RAM |
| `decision-matrix/backend/.env.example` | ✅ | §35–50: DB pool, HTTP retry, circuit breaker, `COMPUTE_RATE_LIMIT`, `UVICORN_WORKERS` |
| `.github/workflows/ci.yml` | ✅ | `pip install -r requirements.txt -r requirements-dev.txt` (pytest-asyncio) |

## 4.4 E2E

**Не запускался** — фича инфраструктурная, без новых UI-сценариев. E2E в CI пройдёт после push (job Playwright не блокирует merge backend-only, но рекомендуется мониторинг).

## 4.5 CI gate (локально)

### Backend

```powershell
cd decision-matrix/backend
venv\Scripts\python.exe -m pip install -r requirements.txt -r requirements-dev.txt
venv\Scripts\python.exe -m pytest tests/ -q
```

| Результат | Значение |
|-----------|----------|
| Passed | **643** |
| Failed | **0** |
| Skipped | 1 |
| Duration | ~176 s |

Stability-тесты (subset из review):

| Файл | Результат |
|------|-----------|
| `test_database_pool.py` | ✅ |
| `test_startup_checks_strict.py` | ✅ |
| `test_alembic_concurrent_lock.py` | ✅ |
| `test_microservice_errors.py` | ✅ |
| `test_job_queue_dedup.py` | ✅ |
| `test_run_planner_async.py` | ✅ |

### Frontend

```powershell
cd decision-matrix/frontend
npm run lint
npm run test
```

| Проверка | Результат |
|----------|-----------|
| ESLint | ✅ 0 errors, 10 warnings (pre-existing unused vars) |
| Vitest | ✅ **1269 passed** / 250 files, ~91 s |

`npm run test:coverage` — не запускался (не в mandate Integrator; CI job выполнит).

## Исправления Integrator

### Integration fix: устаревшие mock-пути в pad DEM тестах

После async-рефакторинга `fetch_opentopography_dem` переехал в `dem_store`; `pad_dem_repository` импортирует `fetch_opentopography_dem_async`. Четыре теста патчили несуществующий атрибут.

**Файлы:**

- `decision-matrix/backend/tests/test_pad_dem_repository.py` — 3 patch → `fetch_opentopography_dem_async` + `AsyncMock`
- `decision-matrix/backend/tests/test_pad_dem_preview.py` — 1 patch → `fetch_opentopography_dem_async` + `AsyncMock`

**До fix:** 639 passed, 4 failed. **После:** 643 passed, 0 failed.

## Предупреждения (не блокеры)

| Источник | Описание |
|----------|----------|
| `job_queue.py:120` | `RuntimeWarning: coroutine 'execute_project_job' was never awaited` — известно из review |
| bugbot / security-review | Не запускались (лимит subagent на Reviewer) |
| Multi-worker staging | `UVICORN_WORKERS=2` + alembic advisory lock — проверить на staging после деплоя |

## Deploy readiness checklist

- [x] Миграция БД — не требовалась
- [x] Dockerfile multi-worker (`UVICORN_WORKERS`)
- [x] docker-compose prod: healthcheck + resource limits
- [x] `.env.example` новые переменные задокументированы
- [x] CI config: `pytest-asyncio` в `requirements-dev.txt`, установка в workflow
- [x] `pytest tests/ -q` — **643 passed**
- [x] `npm run lint` — 0 errors
- [x] `npm run test` — **1269 passed**
- [ ] Push в remote
- [ ] GitHub CI workflow **success**
- [ ] Staging: `UVICORN_WORKERS=2`, проверка `/health` и concurrent alembic lock

## Вердикт

**Deploy ready (локально)** — все CI-equivalent проверки зелёные после integration fix в тестах.

### Следующие шаги для пользователя

1. **Commit** изменения (в т.ч. test fix + integration-log).
2. **Push** → дождаться CI на `Mekcuka/Scaning`:
   ```powershell
   gh run list --repo Mekcuka/Scaning --limit 3
   gh run watch <run-id> --repo Mekcuka/Scaning --exit-status
   ```
3. **Staging multi-worker:** выставить `UVICORN_WORKERS=2` в `app.env`, перезапустить api, проверить:
   - `GET /health` → `database`, `redis`, `alembic_head`
   - логи старта: только один worker выполняет alembic upgrade (advisory lock)
4. Опционально: bugbot/security-review на diff перед prod.
