# Atlas Grid MCP — examples

## Example 1: Count projects

**User:** «Сколько у меня проектов?»

**Agent:**
1. Read `list_projects.json` schema
2. `CallMcpTool` → `list_projects` with `{}`
3. Answer with count and names from `data`

**Do not:** grep the codebase for seed data or run `curl GET /api/v1/projects`.

---

## Example 2: POI analysis status

**User:** «Покажи анализ POI для проекта X»

**Agent:**
1. `list_projects` → find `project_id` for «X»
2. `list_pois` with that `project_id`
3. `get_poi_analysis` per POI (or the one user named)

---

## Example 3: Long-running job

**User:** «Запусти analyze-all и дождись результата»

**Agent:**
1. Confirm user has write access (tool visible in MCP)
2. `start_analyze_all_pois` → capture `job_id`
3. Poll `get_project_job` every few seconds until `completed` or `failed`
4. On success, fetch analyses with `get_poi_analysis`

**Do not:** read job status from SQLite files or mock fixtures in tests.

---

## Example 4: Auth failure

**MCP returns 401**

**Agent:**
1. Tell user token expired
2. Run `.\scripts\get-atlas-grid-token.ps1` (or with `-McpUrl` for local)
3. Ask user to reload MCP in Cursor Settings
4. Retry the original tool call

---

## Example 5: Architecture question (no MCP)

**User:** «Как устроен RBAC для assistant tools?»

**Agent:** Read `docs/features/assistant-tools.md` and source under `decision-matrix/backend/app/assistant/` — **not** MCP.
