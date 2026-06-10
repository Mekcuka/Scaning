# Assistant — Shared Tool Registry



Единый слой tools для AI-помощника (in-process chat), HTTP MCP и stdio dev MCP.



Tools вызывают `app/services/*` и `project_access` — **не** REST handlers из `api/v1/`.



## Tools (42)



### Session & platform



| Tool | REST analog | Module |

|------|-------------|--------|

| `get_me` | `GET /auth/me` | `session.py` |

| `get_assistant_status` | `GET /assistant/status` | `session.py` |

| `get_autoroad_solver_status` | `GET /autoroad-network/solver-status` | `session.py` |



### Projects & POI



| Tool | REST analog | Module |

|------|-------------|--------|

| `list_projects` | `GET /projects` | `projects.py` |

| `get_project` | `GET /projects/{id}` | `projects.py` |

| `get_distance_defaults` | `GET .../distance-defaults` | `projects.py` |

| `list_pois` | `GET .../pois` | `projects.py` |

| `create_project` | `POST /projects` | `projects.py` (**mutating**, admin/analyst) |

| `create_poi` | `POST .../pois` | `projects.py` (**mutating**) |

| `get_cost_rates` | `GET .../rates` | `rates.py` |

| `get_economic_params` | `GET .../economic-params` | `rates.py` |

| `update_cost_rates` | `PUT .../rates` | `rates.py` (**mutating**) |



### Map & analysis



| Tool | REST analog | Module |

|------|-------------|--------|

| `list_infra_layers` | `GET .../infrastructure/layers` | `map.py` |

| `list_infra_objects` | `GET .../infrastructure/objects` | `map.py` |

| `update_infra_object` | `PATCH .../objects/{id}` (metadata) | `map.py` (**mutating**) |

| `batch_delete_map_objects` | `POST .../map/batch-delete` | `map_mutations.py` (**mutating**) |

| `get_poi_analysis` | `GET .../pois/{id}/analysis` | `analysis.py` |

| `get_poi_candidates` | `GET .../pois/{id}/candidates` | `analysis.py` |

| `analyze_poi` | `POST .../pois/{id}/analyze` | `analysis.py` (**mutating**) |

| `start_analyze_all_pois` | `POST .../pois/analyze-all` | `analysis.py` (**mutating**) |

| `list_map3d_custom_models` | `GET .../map3d-custom-models` | `map3d.py` |



### Jobs, flow, logistics, graph



| Tool | REST analog | Module |

|------|-------------|--------|

| `get_project_job` | `GET .../jobs/{id}` / active | `jobs.py` |

| `list_project_jobs` | `GET .../jobs` | `jobs.py` |

| `cancel_project_job` | `POST .../jobs/{id}/cancel` | `jobs.py` (**mutating**) |

| `get_flow_schematic` | `GET .../flow-schematic` | `flow.py` |

| `get_sand_logistics_result` | `GET .../sand-logistics/result` | `sand_logistics.py` |

| `list_networks` | `GET .../networks` | `graph.py` |

| `list_network_nodes` | `GET .../networks/{id}/nodes` | `graph.py` |

| `list_network_edges` | `GET .../networks/{id}/edges` | `graph.py` |



### Reports & imports



| Tool | REST analog | Module |

|------|-------------|--------|

| `list_one_pagers` | `GET .../one-pagers` | `one_pagers.py` |

| `get_one_pager` | `GET .../one-pagers/{id}` | `one_pagers.py` |

| `list_import_logs` | `GET /import/logs` | `imports.py` |

| `get_import_log` | `GET /import/logs/{id}` | `imports.py` |

| `list_import_connections` | `GET .../import_connections` | `imports.py` |



### Admin (role=admin)



| Tool | REST analog | Module |

|------|-------------|--------|

| `admin_list_jobs` | `GET /admin/jobs` | `admin_jobs.py` |

| `admin_jobs_health` | `GET /admin/jobs/health` | `admin_jobs.py` |

| `admin_list_users` | `GET /admin/users` | `admin.py` |

| `admin_stats` | `GET /admin/stats` | `admin.py` |

| `admin_list_assistant_audit` | `GET /admin/assistant/audit` | `admin_audit.py` |



**Не в registry:** `GET .../map3d-custom-models/{id}/file` (бинарный GLB).



## RBAC и mutating



- Handlers call `resolve_project` with appropriate `AccessLevel` / `WriteScope`.

- `list_tools` hides **all** mutating tools from `viewer`.

- `create_project` additionally hidden from `data_manager` (`hide_from_roles`).

- Admin tools use `hide_from_roles` for non-admin roles.



### Confirm (веб-чат)



Mutating tools не выполняются сразу — orchestrator возвращает `pending_action`; подтверждение через `confirm_action_id`. Audit `source=confirm`.



### HTTP MCP (фаза 9)



Mutating tools в `call_tool` → `code=confirm_required` (без `execute_tool`). Read-only и admin read tools работают как раньше.



## Audit log (фаза 9)



Каждый `execute_tool` → строка в `assistant_audit_log` (`user_id`, `tool_name`, `args_hash`, `ok`, `code`, `source`).



## Usage



```python

from app.assistant import ToolContext, execute_tool, list_tools



ctx = ToolContext(user=user, db=db, env="test", tool_source="chat")

tools = list_tools(ctx)

result = await execute_tool("list_projects", {}, ctx)

```



## Adding a tool



1. Add Pydantic input model + async handler in `tools/domain/<module>.py`

2. Call `register_tool(ToolDefinition(...))` from module `register()`

3. Import module in `tools/__init__.py` → `register_all_tools()`

4. Set `categories=cats(CAT_…)` in `ToolDefinition` ([`tools/categories.py`](tools/categories.py)) for chat routing

5. Add RU labels in `chat/tool_labels.py` and `frontend/.../toolLabels.ts` (if mutating — `PENDING_DESCRIPTIONS_RU`)

6. Add test in `tests/test_assistant_tools.py`; для типовых read-ответов — matcher в `chat/formatters/` (см. `formatters/README.md`)



## HTTP MCP (фаза 2 + 9)



- Endpoint: `POST /api/v1/mcp/` (trailing slash обязателен для Cursor)

- Cursor: `scripts/get-atlas-grid-token.ps1` → `.cursor/mcp.json`; rule `.cursor/rules/atlas-grid-mcp.mdc`

- Docs: [transport/README.md](transport/README.md), [assistant-tools.md §9](../../../docs/features/assistant-tools.md)



## Chat (фаза 3 + 7 + 8 + 9)



- `POST /api/v1/assistant/chat`, `POST /api/v1/assistant/chat/stream`, `GET /api/v1/assistant/status`

- **Фаза 7:** категорийный роутинг tools (`tool_router.py`); server-side formatters (`chat/formatters/` — реестр, tool-first, `answer_source`) без галлюцинаций LLM

- UI: `AssistantPanel` в `AppLayout` (MCP hint, confirm card)

- Docs: [chat/README.md](chat/README.md), [assistant.md §16](../../../docs/architecture/assistant.md)



## Dev stdio MCP (фаза 4 + 9.6)



- Entrypoint: `python -m app.assistant.dev.stdio_mcp`

- Cursor server: `atlas-grid-dev` (pytest, search, git; опционально read-only domain tools)

- Docs: [dev/README.md](dev/README.md)



## Admin LLM override (фаза 9.7)

| Метод | Путь | Назначение |
|-------|------|------------|
| `GET` | `/api/v1/admin/assistant/llm-config` | Конфигурация для admin UI (effective + env, embedding, wiki RAG, кэш probe 30 с) |
| `POST` | `/api/v1/admin/assistant/llm-config` | In-memory override: `base_url`, `model`, `api_key`, `max_tokens`, `timeout_seconds`, `embedding_*` |
| `DELETE` | `/api/v1/admin/assistant/llm-config` | Сброс override |
| `POST` | `/api/v1/admin/assistant/llm-probe` | Probe chat (`/models`, `/chat/completions`) и embeddings (`/embeddings`) |
| `POST` | `/api/v1/admin/assistant/llm-test` | Короткий тестовый completion |
| `GET` | `/api/v1/admin/assistant/llm-models` | Список моделей провайдера |

Код probe/override: `app/assistant/llm_probe.py`, `app/assistant/llm_override.py`; API — `app/api/v1/admin_assistant.py`.

Frontend: **Администрирование → AI-помощник** (`/admin/assistant`).

| Файл | Роль |
|------|------|
| `frontend/src/pages/AdminAssistantPage.tsx` | Страница, вкладки, формы |
| `frontend/src/components/admin-assistant/*` | Probe panel, model field, Wiki RAG modal |
| `frontend/src/lib/api/adminApi.ts` | REST-клиент (probe fallback при 404) |

Тесты: `tests/test_admin_assistant_llm.py`, `tests/test_admin_assistant_llm_probe.py`, `frontend/src/pages/AdminAssistantPage.test.tsx`.


