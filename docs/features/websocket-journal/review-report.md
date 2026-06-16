# Отчёт ревью: WebSocket + журнал расчётов

**Дата:** 2026-06-16  
**Роль:** Reviewer  
**Итерация:** loop 2/2 (повторное ревью после Builder fixes)  
**Вердикт:** ✅ **ЗЕЛЁНЫЙ** — готов к интеграции

---

## История

| Итерация | Вердикт | Причина |
|----------|---------|---------|
| loop 1/2 | 🔴 RED | WS-события status/progress/result не публиковались; frontend не обрабатывал step events; WS односторонний |
| loop 2/2 | ✅ GREEN | Все блокеры закрыты (см. ниже) |

---

## Проверки (loop 2/2)

| Проверка | Результат |
|----------|-----------|
| Артефакты Planner + Builder | ✅ plan.md, contract.md, data-model.md, impl-log.md |
| Границы backend | ✅ SQL вынесен в `job_ws_auth.py`; `project_job_run.py` = 384 строк (<400) |
| Границы frontend | ✅ lib/hooks/components; CSS без raw `#fff` |
| Контракт REST + схемы | ✅ 1:1 |
| Контракт WebSocket события | ✅ |
| Контракт WebSocket client→server | ✅ ping→pong, subscribe filter |
| Контракт frontend §7 | ✅ patchJob, updateStep, polling off при WS |
| pytest | ✅ 613 passed, 1 skipped |
| npm test | ✅ 989 passed (207 files) |
| npm lint (фича) | ✅ 0 новых проблем (1 pre-existing error вне фичи) |
| bugbot | ⚠️ не выполнен (API rate limit); заменён ручным review loop 1+2 |
| security-review | ✅ 0 findings medium+ (loop 1) |

---

## Сверка блокеров loop 1 → статус loop 2

| Блокер | Исправление | Статус |
|--------|-------------|--------|
| `job.status_changed` не публиковался | `job_realtime_events.py` + hooks в `mark_job_*` | ✅ |
| `job.progress` не публиковался | `update_job_progress` + `_sync_job_progress_after_step` | ✅ |
| `job.result` не публиковался | `notify_job_result` при terminal status | ✅ |
| Frontend игнорировал step events | `updateStep` в store + handler в `useJobRealtime` | ✅ |
| `updateJob` затирал пустые поля | `patchJob` + `mergeJobFields` | ✅ |
| WS не читал client messages | `read_client()` в `jobs_ws.py`: ping/pong, subscribe | ✅ |
| SQL в `jobs_ws.py` route | `job_ws_auth.py` | ✅ |
| `project_job_run.py` >400 строк | `JOB_STEPS` → `job_step_defs.py` (384 строк) | ✅ |
| Close 4404 | `project_exists` check перед 4403 | ✅ |
| Polling без учёта WS | `realtimeConnected` в `useActiveProjectJob` | ✅ |

---

## Контракт WebSocket — финальная сверка

| Событие / сообщение | contract.md | Код | |
|---------------------|-------------|-----|---|
| `job.step_added` | §1.2 | `job_steps.append_job_step` | ✅ |
| `job.step_updated` | §1.2 | `job_steps.update_job_step` | ✅ |
| `job.status_changed` | §1.2 | `notify_job_status_changed` | ✅ |
| `job.progress` | §1.2 | `notify_job_progress` | ✅ |
| `job.result` | §1.2 | `notify_job_result` | ✅ |
| Client `ping` → `pong` | §1.1 | `jobs_ws.read_client` | ✅ |
| Client `subscribe` | §1.1 | filter по `job_id` | ✅ |
| Auth 4401/4403/4404 | §1.3 | `jobs_ws.py:40-49` | ✅ |
| Redis `job-events:{project_id}` | §6 | `job_events.py` | ✅ |

---

## Замечания (не блокирующие)

1. **`cancel_job` через WS** — в контракте помечен как опциональный; не реализован. Отмена по-прежнему через REST `POST .../cancel`.
2. **Гранулярность шагов в worker** — multi-step jobs всё ещё выполняют `_run_*` одним блоком; шаги переходят в `ok` батчем. WS-события по шагам при этом **работают** (step_added/updated + progress). Уточнение фаз внутри сервисов — отдельная инкрементальная задача (зафиксировано в impl-log).
3. **Backend-тесты WS handshake** — smoke 4401/4403 не добавлен; покрыты unit-тесты шагов + publish. Integrator может добавить E2E при необходимости.
4. **bugbot** — перезапустить при доступности API (не блокирует green).

---

## Handoff к Integrator

> Фаза Reviewer завершена. Вердикт: **зелёный**.  
> Отчёт: `docs/features/websocket-journal/review-report.md`.  
> Контракт REST + WebSocket + frontend реализован; loop 1 блокеры закрыты.  
> Тесты: pytest 613 passed, npm test 989 passed.
>
> **Integrator:** миграция `026_calculation_journal`, CI gate, опционально E2E.
