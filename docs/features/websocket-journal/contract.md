# Контракт API: WebSocket + журнал расчётов

**Версия:** 1.0
**Дата:** 2026-06-16
**Правило:** имена полей финальные. Builder использует их дословно.

---

## 1. WebSocket: `/api/v1/projects/{project_id}/jobs/ws`

**Транспорт:** WebSocket (RFC 6455), текстовые JSON-фреймы.

**Auth:** query-param `?token=<JWT>` (Bearer access token из `sessionStorage`). При невалидном/отсутствующем — close code `4401`.

**Scope:** один проект на соединение. Клиент получает события только по задачам `project_id` из URL.

### 1.1. Client → Server сообщения

#### Subscribe (при установке соединения)
Автоматически — клиент подписывается на project_id из URL. Дополнительно можно фильтровать:

```json
{
  "type": "subscribe",
  "job_id": "uuid-string | null"
}
```
- `job_id: null` (default) — все задачи проекта
- `job_id: "<uuid>"` — только указанная задача

#### Heartbeat ping
```json
{ "type": "ping" }
```
Server отвечает:
```json
{ "type": "pong", "server_time": "2026-06-16T10:00:00Z" }
```

#### Cancel job (опционально, двусторонняя связь)
```json
{
  "type": "cancel_job",
  "job_id": "uuid-string"
}
```
Server: 200 OK или error event (если нет прав).

### 1.2. Server → Client события

Все события имеют общий формат:

```json
{
  "type": "<event_type>",
  "job_id": "uuid-string",
  "project_id": "uuid-string",
  "timestamp": "ISO-8601 UTC"
}
```

#### `job.status_changed` — изменение статуса задачи
```json
{
  "type": "job.status_changed",
  "job_id": "uuid",
  "project_id": "uuid",
  "timestamp": "2026-06-16T10:00:00Z",
  "status": "running",
  "previous_status": "pending",
  "progress": 0.0
}
```

| Поле | Тип | Значения |
|------|-----|----------|
| `status` | string | `pending`, `running`, `completed`, `failed`, `cancelled` |
| `previous_status` | string \| null | предыдущий статус |
| `progress` | float | 0.0–1.0 (доля завершённых шагов) |

#### `job.progress` — обновление прогресса (без смены статуса)
```json
{
  "type": "job.progress",
  "job_id": "uuid",
  "project_id": "uuid",
  "timestamp": "2026-06-16T10:00:01Z",
  "progress": 0.35
}
```

#### `job.step_added` — новый шаг в журнале
```json
{
  "type": "job.step_added",
  "job_id": "uuid",
  "project_id": "uuid",
  "timestamp": "2026-06-16T10:00:02Z",
  "step": {
    "id": "uuid",
    "seq": 2,
    "step_code": "compute_volumes",
    "title": "Расчёт объёмов земляных работ",
    "status": "running",
    "started_at": "2026-06-16T10:00:02Z",
    "finished_at": null,
    "duration_ms": null,
    "detail": null,
    "error_message": null
  }
}
```

#### `job.step_updated` — шаг завершён / изменился
```json
{
  "type": "job.step_updated",
  "job_id": "uuid",
  "project_id": "uuid",
  "timestamp": "2026-06-16T10:00:05Z",
  "step": {
    "id": "uuid",
    "seq": 2,
    "step_code": "compute_volumes",
    "title": "Расчёт объёмов земляных работ",
    "status": "ok",
    "started_at": "2026-06-16T10:00:02Z",
    "finished_at": "2026-06-16T10:00:05Z",
    "duration_ms": 3120,
    "detail": { "volume_cut_m3": 15200.5, "volume_fill_m3": 8400.2 },
    "error_message": null
  }
}
```

| `step.status` | Описание |
|---------------|----------|
| `pending` | шаг создан, не стартовал |
| `running` | шаг выполняется |
| `ok` | шаг успешно завершён |
| `warn` | завершён с предупреждениями (есть `detail.warnings`) |
| `error` | шаг упал (есть `error_message`) |
| `skipped` | шаг пропущен (не применим) |

#### `job.result` — терминальный результат (упрощённый)
```json
{
  "type": "job.result",
  "job_id": "uuid",
  "project_id": "uuid",
  "timestamp": "2026-06-16T10:00:10Z",
  "status": "completed",
  "progress": 1.0,
  "result_summary": {
    "steps_total": 4,
    "steps_ok": 4,
    "steps_warn": 0,
    "steps_error": 0
  },
  "error_message": null
}
```
При `status: "failed"` — `error_message: string`, `result_summary.steps_error > 0`.

#### `error` — ошибка протокола/auth
```json
{
  "type": "error",
  "code": "auth_failed",
  "message": "Невалидный или истёкший токен"
}
```
| code | Когда |
|------|-------|
| `auth_failed` | невалидный JWT (close 4401) |
| `forbidden` | нет доступа к project_id (close 4403) |
| `bad_message` | невалидный JSON / неизвестный type |

### 1.3. Close codes

| Code | Причина |
|------|---------|
| 1000 | нормальное закрытие |
| 4401 | auth failed |
| 4403 | forbidden (нет доступа к проекту) |
| 4404 | project not found |
| 1011 | server error |

---

## 2. REST: `GET /api/v1/projects/{project_id}/jobs/{job_id}/steps`

**Назначение:** первичная загрузка списка шагов при открытии UI / fallback при обрыве WS.

**Auth:** стандартный Bearer JWT + `resolve_project(read, infra)`.

**Response 200:**
```json
{
  "job_id": "uuid",
  "project_id": "uuid",
  "steps": [
    {
      "id": "uuid",
      "seq": 1,
      "step_code": "fetch_dem",
      "title": "Загрузка цифровой модели рельефа",
      "status": "ok",
      "started_at": "2026-06-16T10:00:00Z",
      "finished_at": "2026-06-16T10:00:01Z",
      "duration_ms": 980,
      "detail": { "dem_cells": 250000 },
      "error_message": null
    },
    {
      "id": "uuid",
      "seq": 2,
      "step_code": "compute_volumes",
      "title": "Расчёт объёмов земляных работ",
      "status": "ok",
      "started_at": "2026-06-16T10:00:02Z",
      "finished_at": "2026-06-16T10:00:05Z",
      "duration_ms": 3120,
      "detail": { "volume_cut_m3": 15200.5, "volume_fill_m3": 8400.2 },
      "error_message": null
    }
  ],
  "progress": 0.5,
  "steps_total": 4,
  "steps_completed": 2
}
```

**Response 404:** job или project не найден.
**Response 403:** нет доступа к проекту.

---

## 3. REST: `GET /api/v1/projects/{project_id}/jobs/{job_id}/steps/{step_id}`

Детализация одного шага (для drill-down UI).

**Response 200:** как один элемент из массива `steps` выше.

---

## 4. Расширение существующего `GET /api/v1/projects/{project_id}/jobs/{job_id}`

К существующему `ProjectJobResponse` **добавляются поля** (обратно совместимо):

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "user_id": "uuid",
  "job_type": "pad_earthwork_compute",
  "status": "running",
  "payload": {},
  "result": null,
  "error_message": null,
  "progress": 0.5,
  "started_at": "2026-06-16T10:00:00Z",
  "finished_at": null,
  "created_at": "2026-06-16T09:59:50Z",
  "steps_total": 4,
  "steps_completed": 2,
  "current_step": {
    "seq": 3,
    "step_code": "build_mesh",
    "title": "Построение 3D-сетки"
  }
}
```

`steps_total`, `steps_completed`, `current_step` — **nullable** для задач без журнала (старые записи / неинструментированные job_type). Builder должен гарантировать обратную совместимость.

---

## 5. Pydantic-схемы (для `app/schemas/__init__.py`)

```python
class JobStepResponse(BaseModel):
    id: UUID
    seq: int
    step_code: str
    title: str
    status: str  # pending|running|ok|warn|error|skipped
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_ms: int | None = None
    detail: dict | None = None
    error_message: str | None = None
    model_config = {"from_attributes": True}

class JobStepListResponse(BaseModel):
    job_id: UUID
    project_id: UUID
    steps: list[JobStepResponse]
    progress: float | None = None
    steps_total: int = 0
    steps_completed: int = 0
```

Расширение `ProjectJobResponse`:
```python
class ProjectJobResponse(BaseModel):
    # ... существующие поля ...
    steps_total: int | None = None
    steps_completed: int | None = None
    current_step: dict | None = None  # {seq, step_code, title}
```

---

## 6. Pub/sub канал Redis

**Имя канала:** `job-events:{project_id}` (например `job-events:a412ca57-71d8-4c62-a45a-8ca4073e8fd9`).

**Формат сообщения:** JSON-строка, совпадает с server→client событием (секция 1.2). Worker публикует, web-процесс подписан.

**Команда публикации (worker):**
```
PUBLISH job-events:{project_id} '{"type":"job.step_added",...}'
```

**Подписка (web процесс, `JobEventHub`):**
```python
async def subscribe(self, redis, project_id):
    pubsub = redis.pubsub()
    await pubsub.subscribe(f"job-events:{project_id}")
    async for message in pubsub.listen():
        if message["type"] == "message":
            await self.broadcast(project_id, json.loads(message["data"]))
```

---

## 7. Frontend клиентский контракт

### `createJobWebSocket(projectId, token)`

```typescript
interface JobWebSocketClient {
  close(): void;
  readonly readyState: number;
}
```

**URL:** `${wsBase}/api/v1/projects/${projectId}/jobs/ws?token=${token}`
- `wsBase`: вычисляется из `VITE_API_URL` (`http(s)://` → `ws(s)://`)

### События, обрабатываемые frontend:

| WS event | Действие |
|----------|----------|
| `job.status_changed` | `taskLog.updateJob(...)`, toast на терминальный статус |
| `job.progress` | `taskLog.updateJob({ progress })` |
| `job.step_added` / `job.step_updated` | `taskLog.updateStep(job_id, step)` |
| `job.result` | `taskLog.completeJob(job_id, result)`, toast `success`/`error` |

### Fallback polling

Если `readyState !== OPEN` > 5s — включается `useActiveProjectJob` (2s poll) как backup. При восстановлении WS — polling отключается.

---

## 8. Совместимость

- Старые клиенты (без WS) продолжают работать через REST polling — обратно совместимо.
- `ProjectJobResponse` новые поля nullable — старые frontend не сломаются.
- WebSocket — опциональный транспорт; отсутствие Redis → in-memory мост для dev.
