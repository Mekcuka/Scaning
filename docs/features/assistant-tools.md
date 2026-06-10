# AI Assistant — каталог shared tools (фаза 1)

**Дата:** июнь 2026  
**Для кого:** разработчики, будущие интеграторы AI-помощника  
**Архитектура:** [assistant.md](../architecture/assistant.md)  
**Код:** [`app/assistant/tools/domain/`](../../decision-matrix/backend/app/assistant/tools/domain/)

---

## 1. Статус

| Компонент | Статус |
|-----------|--------|
| Shared Tool Registry (42 tools: 34 read + 8 mutating) | ✅ фазы 1–10 |
| Product wiki (markdown bundle + search tools) | ✅ фаза 10 |
| HTTP MCP `/api/v1/mcp/` (read + mutating block) | ✅ фаза 2, 9 |
| Веб-чат `/assistant/chat` + SSE stream | ✅ фазы 3, 8 |
| UI помощника в React (`AssistantPanel`) | ✅ фазы 3, 9 |
| Dev stdio MCP (pytest, codebase, git) | ✅ фаза 4 |
| Dev MCP domain proxy (read-only, опционально) | ✅ фаза 9.6 |
| Расширение команд (тарифы, cancel job, admin) | ✅ фаза 5 |
| Полное покрытие GET API (read-only) | ✅ фаза 6 |
| Mutating tools + confirm, audit log, rate limits | ✅ фаза 9 |
| Роутинг tools в чате + server-side formatters | ✅ фаза 7 (7.1–7.2, 7.5) |

Tools доступны из **веб-чата** (панель в header), Python-тестов и HTTP MCP (Cursor). В **чате** в prompt LLM попадает 5–12 релевантных tools (не весь registry); типовые ответы с цифрами формируются на сервере без LLM.

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
| 11 | `get_cost_rates` | нет | read project | `GET .../rates` |
| 12 | `get_economic_params` | нет | read project | `GET .../economic-params` |
| 13 | `cancel_project_job` | **да** | write infra | `POST .../jobs/{id}/cancel` |
| 14 | `admin_list_jobs` | нет | **admin** | `GET /admin/jobs` |
| 15 | `admin_jobs_health` | нет | **admin** | `GET /admin/jobs/health` |
| 16 | `get_me` | нет | auth | `GET /auth/me` |
| 17 | `get_assistant_status` | нет | auth | `GET /assistant/status` |
| 18 | `get_autoroad_solver_status` | нет | auth | `GET /autoroad-network/solver-status` |
| 19 | `get_distance_defaults` | нет | read project | `GET .../distance-defaults` |
| 20 | `list_infra_layers` | нет | read project | `GET .../infrastructure/layers` |
| 21 | `get_poi_candidates` | нет | read project | `GET .../pois/{id}/candidates` |
| 22 | `list_networks` | нет | read infra | `GET .../infrastructure/networks` |
| 23 | `list_network_nodes` | нет | read infra | `GET .../networks/{id}/nodes` |
| 24 | `list_network_edges` | нет | read infra | `GET .../networks/{id}/edges` |
| 25 | `list_one_pagers` | нет | read project | `GET .../one-pagers` |
| 26 | `get_one_pager` | нет | read project | `GET .../one-pagers/{id}` |
| 27 | `list_import_logs` | нет | auth (owner) | `GET /import/logs` |
| 28 | `get_import_log` | нет | auth (owner) | `GET /import/logs/{id}` |
| 29 | `list_import_connections` | нет | read infra | `GET .../import_connections` |
| 30 | `list_map3d_custom_models` | нет | read project | `GET .../map3d-custom-models` |
| 31 | `admin_list_users` | нет | **admin** | `GET /admin/users` |
| 32 | `admin_stats` | нет | **admin** | `GET /admin/stats` |
| 33 | `create_project` | **да** | admin/analyst | `POST /projects` |
| 34 | `create_poi` | **да** | write project | `POST .../pois` |
| 35 | `update_infra_object` | **да** | write infra | `PATCH .../objects/{id}` (metadata only) |
| 36 | `analyze_poi` | **да** | write project | `POST .../pois/{id}/analyze` |
| 37 | `update_cost_rates` | **да** | write project | `PUT .../rates` |
| 38 | `batch_delete_map_objects` | **да** | write | `POST .../map/batch-delete` |
| 39 | `admin_list_assistant_audit` | нет | **admin** | `GET /admin/assistant/audit` |
| 40 | `list_wiki_articles` | нет | auth | product help (wiki manifest) |
| 41 | `search_wiki` | нет | auth | product help search |
| 42 | `get_wiki_article` | нет | auth | product help full article |

**RBAC:** `viewer` не видит **ни один** mutating tool (8 шт.). `create_project` скрыт от `viewer` и `data_manager`. Admin tools (#14–15, #31–32, #39) — только `role=admin`.

**Вне scope tools:** бинарная выдача GLB (`GET .../map3d-custom-models/{id}/file`) — не передаётся в LLM.

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

## 8. Roadmap (post-MVP)

**Выполнено (фазы 1–6):** registry, HTTP MCP, веб-чат, dev stdio MCP, расширение команд, все GET read-only → 32 tools.

**Запланировано / в работе:** детали в [assistant.md §16–18](../architecture/assistant.md).

| Фаза | Фокус | Статус |
|------|-------|--------|
| **7** | Стабильность LLM | ✅ 7.1 роутинг, 7.2 formatters (реестр + tool-first), 7.5 тесты; planned: 7.3 context fallback; 7.4 частично (`formatters_count`) |
| **8** | UX чата | ✅ 8.1 SSE, 8.3 UI-контекст, 8.4 chips, 8.5 MCP resources; 8.2 история в БД — planned |
| **9** | Запись и prod | ✅ Mutating tools, audit log, rate limits по роли, MCP token UX, dev MCP domain proxy, admin LLM override |

- ✅ Фаза 7: `tool_router.py`, `chat/formatters/` (реестр, анализ, admin, потоки/песок, misc), `ASSISTANT_CHAT_MAX_ROUTED_TOOLS`
- ✅ `cancel_project_job`, `admin_list_jobs`, `get_cost_rates` (фаза 5)
- ✅ Все GET read-only API (фаза 6)
- ✅ SSE streaming `POST /assistant/chat/stream` (фаза 8.1)
- ✅ UI-контекст чата: `project_name`, `selected_poi_id`, `active_tab` (фаза 8.3)
- ✅ Контекстные chips по маршруту (фаза 8.4)
- ✅ MCP resources read-only (фаза 8.5)
- ✅ Фаза 9: mutating tools (confirm в чате, блок в HTTP MCP), audit log, rate limits, MCP UX

### Mutating tools (фаза 9)

| Tool | REST-аналог | Confirm в чате | HTTP MCP |
|------|-------------|----------------|----------|
| `start_analyze_all_pois` | `POST .../pois/analyze-all` | да | `confirm_required` |
| `cancel_project_job` | cancel job API | да | `confirm_required` |
| `create_project` | `POST /projects` | да (admin/analyst) | `confirm_required` |
| `create_poi` | `POST .../pois` | да | `confirm_required` |
| `update_infra_object` | `PATCH .../objects/{id}` (name/subtype/description) | да | `confirm_required` |
| `analyze_poi` | `POST .../pois/{id}/analyze` | да | `confirm_required` |
| `update_cost_rates` | `PUT .../rates` | да | `confirm_required` |
| `batch_delete_map_objects` | `POST .../map/batch-delete` | да | `confirm_required` |

**Политика HTTP MCP:** mutating tools не выполняются — ответ `code=confirm_required`. Подтверждение только в веб-чате (панель AI-помощник).

### Audit и admin API (фаза 9.3, 9.7)

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/api/v1/admin/assistant/audit` | Журнал вызовов tools (admin, пагинация `limit`, фильтры `tool_name`, `user_id`) |
| `POST` | `/api/v1/admin/assistant/llm-config` | In-memory override LLM (`base_url`, `model`, `api_key`) без рестарта |
| `DELETE` | `/api/v1/admin/assistant/llm-config` | Сброс override |

Tool-аналог журнала: `admin_list_assistant_audit`.

### Rate limits (фаза 9.4)

| Канал | viewer | analyst / data_manager | admin |
|-------|--------|------------------------|-------|
| Chat (`/assistant/chat*`) | 10/min | 20/min | 40/min |
| HTTP MCP | 15/min | 30/min | 60/min |

Ключ slowapi: `ip:user_id`. Viewer: `ASSISTANT_CHAT_MAX_TOOL_ROUNDS_VIEWER=4`.

---

## 9. Подключение Cursor (HTTP MCP)

### URL (обязателен trailing slash)

| Среда | URL |
|-------|-----|
| Prod | `https://erascaning.duckdns.org/api/v1/mcp/` |
| Local | `http://127.0.0.1:8000/api/v1/mcp/` |

Без завершающего `/` сервер отвечает **307 redirect**; Cursor при редиректе **теряет** заголовок `Authorization` → 401.

### Быстрая настройка (Windows, рекомендуется)

Из корня репозитория:

```powershell
.\scripts\get-atlas-grid-token.ps1
```

Скрипт логинится (по умолчанию `admin@oilgas.ru`), записывает `.cursor/mcp.json` с Bearer-токеном (файл в `.gitignore`) и напоминает сделать **Reload** MCP в Cursor.

Локальный backend:

```powershell
.\scripts\get-atlas-grid-token.ps1 `
  -ApiUrl "http://127.0.0.1:8000/api/v1" `
  -McpUrl "http://127.0.0.1:8000/api/v1/mcp/"
```

Шаблон для команды (без секретов): [`.cursor/mcp.json.example`](../../.cursor/mcp.json.example).

### Cursor rule

Правило [`.cursor/rules/atlas-grid-mcp.mdc`](../../.cursor/rules/atlas-grid-mcp.mdc) (`alwaysApply: true`) — агент использует MCP `atlas-grid` для вопросов о **живых данных** приложения (проекты, POI, jobs), а не curl/REST.

### Auth и TTL

- Только **Bearer JWT** (тот же `access_token`, что REST login).
- Токен живёт **~60 мин** — при 401 перезапустите `get-atlas-grid-token.ps1` → Reload MCP.
- На Windows **`${env:VAR}` в HTTP headers** у Cursor часто не работает — используйте скрипт, не переменную окружения в `mcp.json`.
- `list_tools` фильтруется по роли (как REST RBAC).

### Отключение на prod

`ASSISTANT_MCP_ENABLED=false` в `app.env` на VM.

Подробнее: [assistant.md §11](../architecture/assistant.md), [`transport/README.md`](../../decision-matrix/backend/app/assistant/transport/README.md).

---

## 10. Веб-чат (фаза 3)

### UI

Иконка **MessageSquare** в header приложения (слева от «Журнал задач»). Панель `AssistantPanel` — slide-over с session-only историей.

Контекст запроса: `project_id`, `project_name`, `selected_poi_id`, `active_tab`, `route_path` — собирается в [`assistantContext.ts`](../../decision-matrix/frontend/src/lib/assistant/assistantContext.ts); POI синхронизируется со страниц карты, проекта и схем потоков через `useSyncAssistantUiContext`.

### API

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/api/v1/assistant/status` | `{ enabled, model, provider_ready, base_url, mcp_url, mcp_token_ttl_minutes, mcp_setup_hint_ru, formatters_count, formatter_tools, wiki_enabled, wiki_articles_count }` — badge + MCP hint в UI |
| `POST` | `/api/v1/assistant/chat` | `{ messages, project_id?, project_name?, selected_poi_id?, active_tab?, route_path?, confirm_action_id? }` → `ChatResponse` |
| `POST` | `/api/v1/assistant/chat/stream` | Тот же body → SSE (`token`, `reasoning_token`, `tool_start`, `tool_done`, `pending_action`, `done`, `error`) |

Auth: JWT + CSRF (как остальной `/api/v1`). Rate limit по роли: viewer `10/min`, analyst `20/min`, admin `40/min` (`ASSISTANT_CHAT_RATE_LIMIT_*`). HTTP MCP: отдельные лимиты `ASSISTANT_MCP_RATE_LIMIT_*`.

### Mutating tools в чате

При вызове LLM tool с `mutating=true` (например `start_analyze_all_pois`) backend **не выполняет** операцию сразу. Ответ содержит:

```json
{
  "pending_action": {
    "action_id": "<signed>",
    "tool": "start_analyze_all_pois",
    "arguments": { "project_id": "..." },
    "description": "Запустить анализ всех POI в проекте?"
  }
}
```

UI показывает карточку **Подтвердить / Отмена**. Подтверждение — повторный `POST /chat` с `confirm_action_id`. Роль `viewer` не видит mutating tool в `list_tools()`.

### LLM-провайдеры

| Режим | `ASSISTANT_LLM_BASE_URL` | UI-подсказка при сбое |
|-------|--------------------------|------------------------|
| Ollama | `http://127.0.0.1:11434/v1` | «запустите ollama serve» |
| LM Studio | `http://127.0.0.1:1234/v1` | Local Server на `:1234` |
| OpenRouter | `https://openrouter.ai/api/v1` | ключ / лимит free-модели |

Локально: backend и LLM на **одном ПК**. **Не работает:** GitHub Pages + VM backend + LM Studio на ПК — VM не видит `localhost:1234`.

Frontend: [`chatErrors.ts`](../../decision-matrix/frontend/src/lib/assistant/chatErrors.ts) — русские сообщения по `code` из SSE `error` и `base_url` из status (не только «проверьте LM Studio»).

### Типичные ошибки чата

| Симптом | Причина | Решение |
|---------|---------|---------|
| Жёлтый badge, `provider_ready: false` | `GET …/models` недоступен | Запустить Ollama/LM Studio или проверить URL/ключ |
| Badge зелёный, при отправке — ошибка про **OpenRouter 429** | Лимит бесплатной модели | Подождать 1–2 мин, сменить `ASSISTANT_LLM_MODEL`, кредиты на openrouter.ai |
| «Неверный API-ключ» (`llm_auth`) | 401/403 от провайдера | `ASSISTANT_LLM_API_KEY` в `.env`, перезапуск backend |

Коды backend: `llm_rate_limit`, `llm_auth`, `llm_connection`, `llm_config`, `llm_timeout`, `llm_http` — см. [`chat/README.md`](../../decision-matrix/backend/app/assistant/chat/README.md).

### Prod

```env
ASSISTANT_LLM_BASE_URL=https://openrouter.ai/api/v1
ASSISTANT_LLM_API_KEY=<secret>
ASSISTANT_LLM_MODEL=openai/gpt-4o-mini
```

`ASSISTANT_CHAT_ENABLED=false` — чат отключён (404 на `/chat`).

`ASSISTANT_CHAT_MAX_ROUTED_TOOLS` (default `12`) — макс. tools в prompt LLM после категорийного роутинга.

### Качество ответов (фаза 7)

После tool round оркестратор вызывает `try_server_answer_after_tools()` ([`formatters/registry.py`](../../decision-matrix/backend/app/assistant/chat/formatters/registry.py)). Ответ **без второго вызова LLM** при совпадении matcher'а; для list/count — **tool-first** (достаточно успешного tool). Поле `answer_source` в ответе чата: `formatter` | `tool_error` | `llm`.

| Вопрос (примеры) | Tool(s) | Formatter |
|------------------|---------|-----------|
| объекты на карте, сколько объектов | `list_infra_objects` | `format_infra_objects_summary` |
| сколько проектов, список проектов | `list_projects` | `format_projects_summary` (tool-first) |
| сколько POI, список точек | `list_pois` | `format_pois_summary` (tool-first) |
| слои карты | `list_infra_layers` | `format_layers_summary` |
| карточка проекта | `get_project` | `format_project_card` |
| анализ POI, превышения | `get_poi_analysis` | `format_poi_analysis_summary` |
| кандидаты инфраструктуры | `get_poi_candidates` | `format_poi_candidates_summary` |
| статус задачи, фоновая задача | `get_project_job`, `list_project_jobs` | `format_job_summary` |
| тарифы, ставки | `get_cost_rates` | `format_cost_rates_summary` |
| экономика, OPEX | `get_economic_params` | `format_economic_params_summary` |
| журнал задач (admin) | `admin_list_jobs` | `format_admin_jobs_summary` |
| здоровье очереди (admin) | `admin_jobs_health` | `format_admin_jobs_health` |
| схема потоков | `get_flow_schematic`, `get_economic_flow` | `format_flow_schematic_summary` |
| логистика песка | `get_sand_logistics_result` | `format_sand_logistics_summary` |
| one-pager, импорт, сети, 3D | `list_one_pagers`, `list_import_*`, `list_networks`, `list_map3d_custom_models` | misc formatters |
| ошибка единственного tool | любой | `try_tool_error_answer` (без LLM) |
| N проектов + задача в проекте | `list_projects` + `get_project_job` | composite (`misc.py`) |
| профиль / статус LLM | `get_me`, `get_assistant_status` | `misc.py` |

Реестр: 20 matcher'ов, ~24 tool names — [`formatters/registry.py`](../../decision-matrix/backend/app/assistant/chat/formatters/registry.py). Документация пакета: [`formatters/README.md`](../../decision-matrix/backend/app/assistant/chat/formatters/README.md).

**Роутинг tools (только чат):** [`tool_router.py`](../../decision-matrix/backend/app/assistant/chat/tool_router.py) — сигналы: `active_tab`, ключевые слова, core-set (`list_projects`, `get_me`, wiki tools), fallback при <3 tools. Категории на `ToolDefinition.categories` (`projects`, `map`, `jobs`, `rates`, `analysis`, `flow`, `admin`, `session`, `help`). HTTP MCP и dev MCP по-прежнему видят **полный** registry.

Подробнее: [`chat/README.md`](../../decision-matrix/backend/app/assistant/chat/README.md), [assistant.md §16](../architecture/assistant.md).

---

## 14. MCP resources (фаза 8.5)

HTTP MCP `atlas-grid` отдаёт read-only **resources** — документацию и OpenAPI без загрузки 32 tools в prompt Cursor.

### URI

| URI | Содержимое | mimeType |
|-----|------------|----------|
| `wiki://index` | Manifest всех статей (`manifest.json`) | `application/json` |
| `wiki://{slug}` | Статья из [`docs/wiki/`](../wiki/) (bundle в backend) | `text/markdown` |
| `docs://calculation-logic` | `bundle/extras/calculation-logic-flow.md` | `text/markdown` |
| `docs://infrastructure-subtypes` | `bundle/extras/infrastructure_subtypes.json` | `application/json` |
| `openapi://v1` | Снимок `app.openapi()` FastAPI | `application/json` |

Реализация: [`knowledge/store.py`](../../decision-matrix/backend/app/assistant/knowledge/store.py), [`transport/resources.py`](../../decision-matrix/backend/app/assistant/transport/resources.py).

---

## 15. Product wiki (фаза 10)

Markdown-вики для вопросов «как пользоваться» — отдельно от live data tools.

| Компонент | Путь |
|-----------|------|
| Исходники статей | [`docs/wiki/articles/`](../wiki/articles/) |
| Runtime bundle | `app/assistant/knowledge/bundle/` |
| Sync | `python scripts/sync-assistant-wiki.py` |
| Store / search | [`knowledge/`](../../decision-matrix/backend/app/assistant/knowledge/) |
| Tools | [`tools/domain/knowledge.py`](../../decision-matrix/backend/app/assistant/tools/domain/knowledge.py) |

`GET /assistant/status`: `wiki_enabled`, `wiki_articles_count`.

Конфиг: `ASSISTANT_WIKI_ENABLED`, `ASSISTANT_WIKI_ROOT`, `ASSISTANT_WIKI_MAX_ARTICLE_CHARS`.

**v1:** keyword search. **v2 (RAG):** гибрид keyword + vector (`knowledge/rag.py`) — embeddings через `/embeddings` LLM API, fallback TF-IDF. `search_wiki` → поле `mode` в ответе; status → `wiki_rag_*`.

### Auth

Те же правила, что для tools: **Bearer JWT**, URL с trailing slash (`/api/v1/mcp/`).

### Пример (JSON-RPC)

```json
{ "jsonrpc": "2.0", "method": "resources/list", "params": {}, "id": 1 }
```

```json
{
  "jsonrpc": "2.0",
  "method": "resources/read",
  "params": { "uri": "docs://calculation-logic" },
  "id": 2
}
```

Ответ: `result.contents[]` с полями `text`, `mimeType`.

Подробнее: [`transport/README.md`](../../decision-matrix/backend/app/assistant/transport/README.md).

---

## 11. Dev stdio MCP (фаза 4)

Отдельный MCP-сервер **`atlas-grid-dev`** для разработки в Cursor. Не смешивать с HTTP `atlas-grid` (live data).

### Tools

| Tool | Аргументы | Результат |
|------|-----------|-----------|
| `run_pytest_tool` | `path`, `keyword`, `markers`, `timeout_seconds` | exit_code, stdout/stderr tail |
| `search_codebase_tool` | `query`, `glob`, `max_results` | matches `{ path, line, snippet }` |
| `git_status_tool` | optional `path` | branch, short status |
| `git_log_tool` | `max_count`, optional `path` | oneline commits |

### Cursor setup

```powershell
.\scripts\get-atlas-grid-token.ps1 -IncludeDevMcp
```

Или вручную из [`.cursor/mcp.json.example`](../../.cursor/mcp.json.example):

```json
"atlas-grid-dev": {
  "command": "<repo>/decision-matrix/backend/venv/Scripts/python.exe",
  "args": ["-m", "app.assistant.dev.stdio_mcp"],
  "cwd": "<repo>/decision-matrix/backend"
}
```

Правила Cursor:
- [`.cursor/rules/atlas-grid-dev-mcp.mdc`](../../.cursor/rules/atlas-grid-dev-mcp.mdc) — pytest, search, git
- [`.cursor/rules/atlas-grid-mcp.mdc`](../../.cursor/rules/atlas-grid-mcp.mdc) — live app data

### Конфиг

| Env | Default |
|-----|---------|
| `ASSISTANT_DEV_MCP_ENABLED` | `true` |
| `ASSISTANT_DEV_MCP_DOMAIN_TOOLS` | `false` | `true` — read-only domain tools из registry |
| `ASSISTANT_DEV_MCP_USER_EMAIL` | `admin@test.ru` | Пользователь SQLite для domain proxy |
| `ASSISTANT_DEV_MCP_REPO_ROOT` | `""` (auto) |

`ENVIRONMENT=production` — entrypoint отказывается стартовать. Mutating tools в dev MCP **не** регистрируются.

Подробнее: [`dev/README.md`](../../decision-matrix/backend/app/assistant/dev/README.md), [assistant.md §13](../architecture/assistant.md).

---

## 12. Команды чата (фаза 5)

Веб-чат и MCP используют **один registry** — новые tools доступны в обоих каналах.

### Быстрые команды в UI

При пустой истории `AssistantPanel` показывает chips: **Проекты**, **Активная задача**, **Тарифы**, **POI**; для admin — **Журнал задач**.

### Mutating с подтверждением

Все 8 mutating tools → `pending_action` + кнопка «Подтвердить» в чате. В HTTP MCP — `confirm_required` (см. таблицу в §8).

### Отображение tool calls

Под ответом помощника: `Использовано: Список проектов ✓, Тарифы проекта ✓`.

### System prompt

Orchestrator включает шпаргалку доступных tools на русском ([`tool_labels.py`](../../decision-matrix/backend/app/assistant/chat/tool_labels.py)).

Подробнее: [assistant.md §14](../architecture/assistant.md).

---

## 13. Полное покрытие GET API (фаза 6)

Все **read-only** REST `GET` эндпоинты приложения доступны помощнику через shared registry (веб-чат + HTTP MCP). Mutating (`POST`/`PUT`/`PATCH`/`DELETE`) — по-прежнему только отдельные tools с confirm или вне registry.

| Роль | Tools (примерно) |
|------|------------------|
| analyst | 34 (26 read + 8 mutating) |
| data_manager | 33 (как analyst, без `create_project`) |
| viewer | 26 (только read, без mutating и admin) |
| admin | 39 (все analyst + 5 admin tools) |

---

## 15. Tool categories (фаза 7.1)

Категории задаются в [`tools/categories.py`](../../decision-matrix/backend/app/assistant/tools/categories.py) и поле `ToolDefinition.categories` при `register_tool`.

| Категория | Tools (примеры) |
|-----------|-----------------|
| `session` | `get_me`, `get_assistant_status`, `get_autoroad_solver_status` |
| `projects` | `list_projects`, `get_project`, `list_pois`, `create_poi`, imports, one-pagers |
| `map` | `list_infra_objects`, `list_infra_layers`, `update_infra_object`, graph/network, map3d |
| `jobs` | `get_project_job`, `list_project_jobs`, `cancel_project_job` |
| `rates` | `get_cost_rates`, `get_economic_params`, `update_cost_rates`, `get_distance_defaults` |
| `analysis` | `get_poi_analysis`, `analyze_poi`, `start_analyze_all_pois`, … |
| `flow` | `get_flow_schematic`, `get_sand_logistics_result` |
| `admin` | `admin_list_jobs`, `admin_stats`, `admin_list_assistant_audit`, … |

При добавлении tool укажите `categories=cats(CAT_…)` и RU-label в `tool_labels.py`. Для типовых read-сценариев с числами — добавьте `FormatterSpec` в [`chat/formatters/`](../../decision-matrix/backend/app/assistant/chat/formatters/) (см. `formatters/README.md`).
