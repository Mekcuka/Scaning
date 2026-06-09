# Assistant — Shared Tool Registry

Единый слой tools для AI-помощника (in-process chat), HTTP MCP (фаза 2) и stdio dev MCP (фаза 4).

Tools вызывают `app/services/*` и `project_access` — **не** REST handlers из `api/v1/`.

## Tools (10)

| Tool | Mutating | REST analog | Module |
|------|----------|-------------|--------|
| `list_projects` | no | `GET /projects` | `tools/domain/projects.py` |
| `get_project` | no | `GET /projects/{id}` | `tools/domain/projects.py` |
| `list_pois` | no | `GET /projects/{id}/pois` | `tools/domain/projects.py` |
| `list_infra_objects` | no | `GET .../infrastructure/objects` | `tools/domain/map.py` |
| `get_poi_analysis` | no | `GET .../pois/{id}/analysis` | `tools/domain/analysis.py` |
| `start_analyze_all_pois` | **yes** | `POST .../pois/analyze-all` | `tools/domain/analysis.py` |
| `get_project_job` | no | `GET .../jobs/{id}` / `.../jobs/active` | `tools/domain/jobs.py` |
| `list_project_jobs` | no | `GET .../jobs` | `tools/domain/jobs.py` |
| `get_sand_logistics_result` | no | `GET .../sand-logistics/result` | `tools/domain/sand_logistics.py` |
| `get_flow_schematic` | no | `GET .../flow-schematic` | `tools/domain/flow.py` |

### Async analysis flow

1. `start_analyze_all_pois` → `{ job_id, job_type, status }` (or sync `result` when jobs disabled)
2. `get_project_job` with `{ project_id }` (no `job_id`) → active job status
3. `get_poi_analysis` per POI when complete

## Usage

```python
from app.assistant import ToolContext, execute_tool, list_tools

ctx = ToolContext(user=user, db=db, env="test")
tools = list_tools(ctx)
result = await execute_tool("list_projects", {}, ctx)
```

## RBAC

- Handlers call `resolve_project` with appropriate `AccessLevel` / `WriteScope`.
- `list_tools` hides mutating tools from `viewer` role.
- Admin-only tools are not included in this scaffold.

## Adding a tool

1. Add Pydantic input model + async handler in `tools/domain/<module>.py`
2. Call `register_tool(ToolDefinition(...))` from module `register()`
3. Import module in `tools/__init__.py` → `register_all_tools()`
4. Add test in `tests/test_assistant_tools.py`

## Future phases

- `transport/` — HTTP MCP mount (see [docs/architecture/assistant.md](../../../docs/architecture/assistant.md))
- `chat/` — `POST /assistant/chat`
- `dev/` — pytest, codebase search
