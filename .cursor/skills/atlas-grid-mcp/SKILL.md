---
name: atlas-grid-mcp
description: >-
  Queries live Atlas Grid application data via the atlas-grid MCP server (projects,
  POI, infrastructure, jobs, sand logistics, flow schematics, analysis results).
  Use when the user asks about live/runtime data, counts, statuses, or persisted
  calculation results — including Russian prompts like «сколько проектов», «статус
  задачи», «анализ POI». Do not use curl, raw REST, or code guessing for live data.
---

# Atlas Grid MCP

Для вопросов о живых данных иду в MCP, а не в curl/код.

When the user asks about **live application data**, use the **`atlas-grid`** MCP server — not raw `curl`, REST calls, or guessing from source code.

## Decision rule

| Question type | Action |
|---------------|--------|
| Live data (projects, POI, jobs, analysis, infra on map) | **MCP** (`CallMcpTool` → `atlas-grid`) |
| Source code, architecture, docs in repo | Read/edit files |
| Local pytest, git | Shell / repo tools |

## MCP workflow

1. **Read tool schema first** — descriptors live under the MCP file system (`mcps/project-0-Cursore-atlas-grid/tools/*.json`). Never call a tool without checking required parameters.
2. **Pick the right tool** (see mapping below).
3. **Call** via `CallMcpTool` with `server: "project-0-Cursore-atlas-grid"` (configured in `.cursor/mcp.json` as `atlas-grid`).
4. On **401/unauthorized**: refresh token (Auth section), reload MCP in Cursor Settings, retry once.
5. If a tool cannot answer the question, say what MCP lacks — do not fall back to `curl` or invent data from code.

## Tool mapping

| User intent | MCP tool | Notes |
|-------------|----------|-------|
| List/count projects | `list_projects` | No args |
| Project details | `get_project` | `project_id` |
| POI on project | `list_pois` | `project_id` |
| Infra objects / bbox | `list_infra_objects` | `project_id`, optional `bbox`, `subtype` |
| POI analysis results | `get_poi_analysis` | `project_id`, `poi_id` |
| Start analyze-all | `start_analyze_all_pois` | **Mutating** — HTTP MCP returns `confirm_required`; use web chat to confirm |
| Job status / poll | `get_project_job` | `project_id`; optional `job_id` |
| Job history | `list_project_jobs` | `project_id` |
| Sand logistics | `get_sand_logistics_result` | `project_id` |
| Flow schematic | `get_flow_schematic` | `project_id`, `poi_id`, `kind`: `technology` \| `economic` |

Tools are **RBAC-filtered** per user role (same as REST). `viewer` does not see mutating tools. HTTP MCP blocks all mutating tools with `confirm_required` — confirm in the web assistant panel only.

## Common workflows

**«Какие у меня проекты?»** → `list_projects`

**«Запусти анализ и скажи когда готово»**
1. `start_analyze_all_pois` → `job_id`
2. Poll `get_project_job` with `{ project_id }` until `status: completed`
3. `get_poi_analysis` for needed POIs

**«Что на карте в bbox?»** → `list_infra_objects` with `bbox`

**«Схема потоков для скважины X»**
1. `list_pois` → resolve `poi_id` by name
2. `get_flow_schematic` with `kind: "technology"` or `"economic"`

More scenarios: [examples.md](examples.md)

## Auth

- Bearer JWT in `.cursor/mcp.json` (gitignored; see `.cursor/mcp.json.example`).
- **Windows:** `${env:ATLAS_GRID_ACCESS_TOKEN}` in HTTP headers often fails — run:

```powershell
.\scripts\get-atlas-grid-token.ps1
```

- **Local backend:** add `-McpUrl http://127.0.0.1:8000/api/v1/mcp`
- Token TTL ~60 min. On 401: re-run script, reload MCP in Cursor Settings.
- Prod URL: `https://erascaning.duckdns.org/api/v1/mcp`

## Docs

- [assistant-tools.md](../../../docs/features/assistant-tools.md) — parameters and responses
- [transport/README.md](../../../decision-matrix/backend/app/assistant/transport/README.md) — MCP transport
