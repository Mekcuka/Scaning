# integration-log.md — WebSocket + журнал расчётов

**Роль:** Integrator  
**Дата:** 2026-06-16  
**Предусловие:** review-report.md — ✅ ЗЕЛЁНЫЙ (loop 2/2)

---

## 4.1 Миграция БД

| Шаг | Статус |
|-----|--------|
| Файл `alembic/versions/026_calculation_journal.py` | ✅ существует |
| Идемпотентность (`insp.get_table_names()`) | ✅ |
| Downgrade | ✅ |
| `alembic upgrade head` локально (PostgreSQL) | ✅ `025 → 026_calculation_journal` |
| `alembic current` | ✅ `026_calculation_journal (head)` |

Таблица: `project_job_steps` — создана на локальной БД.

---

## 4.2 Регистрация job_type

**Новых job_type не требуется** — фича инструментирует существующие 9 типов в `project_jobs.py` / `job_step_defs.py`.

| Проверка | Статус |
|----------|--------|
| `ALLOWED_JOB_TYPES` без изменений | ✅ |
| Шаги в `JOB_STEPS` для всех типов | ✅ |

---

## 4.3 Docker / compose

**Новый микросервис не требуется** — интеграция в монолит `decision-matrix/backend`.

| Компонент | Статус |
|-----------|--------|
| `deploy/docker-compose.yml` — Redis | ✅ уже есть (`decision-matrix-redis`) |
| `deploy/docker-compose.yml` — API healthcheck | ✅ `/health` |
| `deploy/Caddyfile` — reverse_proxy api:8000 | ✅ Caddy проксирует WebSocket автоматически |
| Изменения compose | **не требуются** |

**Заметка для prod:** heartbeat 30s в `jobs_ws.py` покрывает idle-timeout прокси. При проблемах на VM — проверить логи Caddy и `start_redis_bridge()` при `jobs_use_queue=True`.

---

## 4.4 E2E

| Проверка | Статус |
|----------|--------|
| Dedicated E2E `websocket-journal` | ⚠️ **нет** (e2e/*.spec.ts не покрывают WS/journal) |
| Регрессия существующих E2E | не прогонялась локально (требует поднятый API) |

Рекомендация post-deploy: добавить Playwright-сценарий «запуск POI analyze → прогресс в TaskLogPanel» (не блокирует green Reviewer).

---

## 4.5 CI gate (локально)

| Job | Результат |
|-----|-----------|
| `pytest tests/ -q` | ✅ **613 passed**, 1 skipped |
| `npm run test` | ✅ **989 passed** (207 files) |
| `npm run test:coverage` | ✅ exit 0 |
| `npm run lint` | ⚠️ 1 pre-existing error (`padClusteringSummaryTableView.ts`) — вне фичи |
| `mark-tests-ok.marker` | ✅ обновлён |

**Push / GitHub CI:** не выполнялся (ожидает явного запроса пользователя на commit + push).

---

## Чеклист Integrator

- [x] Миграция применена локально
- [x] job_type — верифицирован (новых нет)
- [x] docker-compose — изменений не требуется; Redis на месте
- [x] Healthcheck API — существующий OK
- [ ] E2E websocket-journal — не добавлен (optional)
- [x] pytest + npm test зелёные
- [ ] Push + CI GitHub — **pending user**

---

## Handoff

Фича **websocket-journal** интегрирована локально:

1. Миграция `026` на head
2. Монолит + Redis pub/sub — без новых контейнеров
3. Локальные CI-гейты пройдены

**Следующий шаг для деплоя:** commit изменений → push → дождаться CI на `Mekcuka/Scaning` → деплoy Pages/VM по workflow.
