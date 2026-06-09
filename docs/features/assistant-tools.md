# AI Assistant — каталог shared tools (фаза 1)

**Дата:** июнь 2026  
**Для кого:** разработчики, будущие интеграторы AI-помощника  
**Архитектура:** [assistant.md](../architecture/assistant.md)  
**Код:** [`app/assistant/tools/domain/`](../../decision-matrix/backend/app/assistant/tools/domain/)

---

## 1. Статус

| Компонент | Статус |
|-----------|--------|
| Shared Tool Registry (10 tools) | ✅ реализован |
| HTTP MCP `/api/v1/mcp` | ✅ фаза 2 |
| Веб-чат `/assistant/chat` | ⬜ фаза 3 |
| UI помощника в React | ⬜ фаза 3 |
| Dev stdio MCP (pytest, codebase) | ⬜ фаза 4 |

Пользовательский UI **пока отсутствует** — tools доступны из Python-тестов и HTTP MCP (Cursor).

---

## 2. Сводная таблица tools

| # | Tool | Mutating | Мин. доступ | REST-аналог |
|---|------|----------|-------------|-------------|
| 1 | `list_projects` | нет | любая роль | `GET /api/v1/projects` |
| 2 | `get_project` | нет | read project | `GET /api/v1/projects/{id}` |
| 3 | `list_pois` | нет | read project | `GET /api/v1/projects/{id}/pois` |
| 4 | `list_infra_objects` | нет | read project | `GET .../infrastructure/objects` |
| 5 | `get_poi_analysis` | нет | read project | `GET .../pois/{id}/analysis` |
| 6 | `start_analyze_all_pois` | **да** | write project | `POST .../pois/analyze-all` |
| 7 | `get_project_job` | нет | read project | `GET .../jobs/{id}` / `.../jobs/active` |
| 8 | `list_project_jobs` | нет | read project | `GET .../projects/{id}/jobs` |
| 9 | `get_sand_logistics_result` | нет | read infra | `GET .../sand-logistics/result` |
| 10 | `get_flow_schematic` | нет | read project | `GET .../flow-schematic` |

**RBAC в списке tools:** роль `viewer` **не видит** tool #6 (`start_analyze_all_pois`) в `list_tools()`, но может вызывать read-only tools (#1–5, #7–10) при доступе к проекту.

---

## 3. Параметры и ответы

### 3.1 `list_projects`

**Аргументы:** `{}`

**Ответ:** массив проектов (как `ProjectResponse` в REST) — id, name, visibility, poi_count, owner.

**Модуль:** `tools/domain/projects.py`

---

### 3.2 `get_project`

**Аргументы:**

```json
{ "project_id": "uuid" }
```

**Ответ:** один проект с `poi_count`.

---

### 3.3 `list_pois`

**Аргументы:**

```json
{ "project_id": "uuid" }
```

**Ответ:** массив POI (`POIResponse`).

---

### 3.4 `list_infra_objects`

**Аргументы:**

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `project_id` | UUID | да | Проект |
| `subtype` | string | нет | Фильтр подтипа |
| `q` | string | нет | Поиск по name / properties |
| `bbox` | string | нет | `minLon,minLat,maxLon,maxLat` |
| `visible_layers_only` | bool | нет | default `true` |

**Ответ:** массив объектов инфраструктуры (`InfraObjectResponse`).

---

### 3.5 `get_poi_analysis`

**Аргументы:**

```json
{ "project_id": "uuid", "poi_id": "uuid" }
```

**Ответ:** обогащённый анализ окружения POI (как REST `GET .../analysis`).  
**Ошибка `not_found`:** анализ ещё не выполнялся.

---

### 3.6 `start_analyze_all_pois` (mutating)

**Аргументы:**

```json
{ "project_id": "uuid" }
```

**Ответ (async, очередь включена):**

```json
{
  "job_id": "uuid",
  "job_type": "poi_analyze_all",
  "status": "pending",
  "async": true
}
```

**Ответ (sync fallback, `JOBS_SYNC_FALLBACK` / без Redis):**

```json
{
  "async": false,
  "result": { ... }
}
```

**Ошибка `conflict`:** в проекте уже есть активная job.

---

### 3.7 `get_project_job`

**Аргументы:**

```json
{ "project_id": "uuid", "job_id": "uuid | null" }
```

- Если `job_id` **не указан** — возвращается **активная** job проекта или `null`.
- Если указан — конкретная job по id.

**Ответ:** `ProjectJobResponse` (status, progress, result, error_message, …).

---

### 3.8 `list_project_jobs`

**Аргументы:**

```json
{ "project_id": "uuid", "limit": 30 }
```

`limit`: 1–100, default 30.

**Ответ:**

```json
{ "items": [...], "total": 5, "limit": 30 }
```

---

### 3.9 `get_sand_logistics_result`

**Аргументы:**

```json
{ "project_id": "uuid" }
```

**Ответ:** `SandLogisticsAnalyzeResponse`.  
**Ошибка `not_found`:** расчёт логистики песка ещё не выполнялся.

---

### 3.10 `get_flow_schematic`

**Аргументы:**

```json
{
  "project_id": "uuid",
  "poi_id": "uuid",
  "kind": "technology | economic"
}
```

`kind` default: `"technology"`.

- `technology` → технологическая PFD (`FlowSchematicResponse`)
- `economic` → экономическая схема (`EconomicFlowResponse`)

---

## 4. Типичные сценарии для AI-агента

### 4.1 «Какие у меня проекты?»

1. `list_projects` → список имён и id.

### 4.2 «Запусти анализ всех POI и скажи, когда готово»

1. `start_analyze_all_pois` → `job_id`
2. `get_project_job` с `{ project_id }` (без `job_id`) — poll статуса
3. При `status: completed` → `get_poi_analysis` для нужных POI

### 4.3 «Что на карте в этом bbox?»

1. `list_infra_objects` с `bbox` и опционально `subtype`

### 4.4 «Покажи схему потоков для скважины X»

1. `list_pois` → найти `poi_id` по имени (на стороне LLM)
2. `get_flow_schematic` с `kind: "technology"` или `"economic"`

---

## 5. Формат результата `execute_tool`

```python
ToolResult(
    ok=True,
    data={...},      # при успехе
    error=None,
    code=None,
)
```

При ошибке:

```python
ToolResult(ok=False, error="Project not found", code="not_found")
```

Коды: `not_found`, `forbidden`, `conflict`, `validation`, `unauthorized`, `error`.

---

## 6. Пример вызова из кода

```python
from app.assistant import ToolContext, execute_tool, list_tools

ctx = ToolContext(user=current_user, db=db, env="production")

# Список доступных tools для роли
tools = list_tools(ctx)

# Выполнение
result = await execute_tool("list_projects", {}, ctx)
if result.ok:
    projects = result.data
else:
    logger.warning("Tool failed: %s (%s)", result.error, result.code)
```

---

## 7. Сервисный слой (откуда берутся данные)

| Tool | Основные services |
|------|-------------------|
| 1–3 | `project_access`, `serializers` |
| 4 | `infra_bbox_filter`, `serializers` |
| 5 | `infrastructure_analysis.build_enriched_analysis_from_db` |
| 6 | `job_enqueue`, `infrastructure_analysis.run_project_pois_analysis` |
| 7–8 | `project_jobs` |
| 9 | `sand_logistics_store` |
| 10 | `flow_schematic_store`, `economic_flow_schematic` |

---

## 8. Roadmap (не в фазе 1)

- Mutating tools: create project, cancel job, map edit (с confirm в UI)
- Admin tools: `admin_list_jobs` (role=admin)
- MCP resources: `docs://calculation-logic`, OpenAPI snapshot
- Аудит действий через assistant (FR post-MVP)

---

## 9. Подключение Cursor (HTTP MCP)

**URL:** `http://127.0.0.1:8000/api/v1/mcp` (локально) или `https://erascaning.duckdns.org/api/v1/mcp` (prod).

1. Запустите backend (`python run_local.py`).
2. Получите access token: `POST /api/v1/auth/login` с email/password demo-пользователя.
3. Добавьте в настройки MCP Cursor (не коммитьте токены в git):

```json
{
  "mcpServers": {
    "atlas-grid": {
      "url": "http://127.0.0.1:8000/api/v1/mcp",
      "headers": {
        "Authorization": "Bearer <access_token>"
      }
    }
  }
}
```

**Auth:** только Bearer JWT (обязателен). Список tools фильтруется по роли пользователя (как REST RBAC).

**Отключение на prod:** `ASSISTANT_MCP_ENABLED=false` в `app.env` на VM.

Подробнее: [assistant.md §11](../architecture/assistant.md), [`transport/README.md`](../../decision-matrix/backend/app/assistant/transport/README.md).
