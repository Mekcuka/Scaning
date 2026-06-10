# HTTP MCP transport (Streamable HTTP)

Mount point: **`/api/v1/mcp/`** (config `ASSISTANT_MCP_PATH` = `/api/v1/mcp`; ASGI mount на `path + "/"`).

## Architecture

```
POST /api/v1/mcp/
  → McpAuthMiddleware (Bearer JWT required)
  → FastMCP (stateless Streamable HTTP)
  → app/assistant/registry.py (list_tools / execute_tool)
  → app/services/*
```

Implementation: [`auth.py`](auth.py), [`http_mcp.py`](http_mcp.py). Wired in [`app/main.py`](../../main.py) via `mount_assistant_mcp(app)` and combined lifespan (`mcp_lifespan()`).

## Configuration

| Env / setting | Default | Description |
|---------------|---------|-------------|
| `ASSISTANT_MCP_ENABLED` | `true` | Set `false` to disable mount |
| `ASSISTANT_MCP_PATH` | `/api/v1/mcp` | Base path; mount is `path + "/"` |
| `ASSISTANT_MCP_RATE_LIMIT_*` | viewer `15/min`, default `30/min`, admin `60/min` | Per-role rate limit (`McpAuthMiddleware`) |

## Mutating tools (фаза 9)

HTTP MCP **не выполняет** mutating tools. `call_tool` для `mutating=True` возвращает JSON:

```json
{ "ok": false, "code": "confirm_required", "error": "Mutating tools require confirmation in the web assistant chat..." }
```

Подтверждение — только в веб-чате (`AssistantPanel` → «Подтвердить»). Read-only tools и admin read tools работают без ограничений.

Список mutating: см. [assistant-tools.md §8](../../../docs/features/assistant-tools.md).

## Cursor setup

### Prod (рекомендуется)

```powershell
# from repo root
.\scripts\get-atlas-grid-token.ps1
```

Затем **Cursor → Settings → Tools & MCP → Reload** `atlas-grid`.

### Local backend

```powershell
.\scripts\get-atlas-grid-token.ps1 `
  -ApiUrl "http://127.0.0.1:8000/api/v1" `
  -McpUrl "http://127.0.0.1:8000/api/v1/mcp/"
```

### Файлы в репозитории

| Файл | Назначение |
|------|------------|
| `.cursor/mcp.json` | Рабочий конфиг с токеном (**gitignored**) |
| `.cursor/mcp.json.example` | Шаблон для команды |
| `.cursor/rules/atlas-grid-mcp.mdc` | Rule: агент использует MCP для live data |

### Важно

- URL **со slash**: `.../api/v1/mcp/` — без него 307 redirect, Cursor теряет `Authorization` → 401.
- Токен **~60 мин** (`ACCESS_TOKEN_EXPIRE_MINUTES`); при 401 — снова `get-atlas-grid-token.ps1`.
- Подсказка в UI: `GET /api/v1/assistant/status` → `mcp_url`, `mcp_setup_hint_ru`; блок «Подключение Cursor MCP» в `AssistantPanel`.
- Windows: `${env:TOKEN}` в HTTP headers Cursor часто **не подставляет** — используйте скрипт.
- Prod URL: `https://erascaning.duckdns.org/api/v1/mcp/`

## Resources (фаза 8.5)

Read-only MCP resources — документация и OpenAPI без вызова tools.

| URI | Источник |
|-----|----------|
| `wiki://index` | `knowledge/bundle/manifest.json` |
| `wiki://{slug}` | `knowledge/bundle/articles/*.md` |
| `docs://calculation-logic` | `knowledge/bundle/extras/calculation-logic-flow.md` |
| `docs://infrastructure-subtypes` | `knowledge/bundle/extras/infrastructure_subtypes.json` |
| `openapi://v1` | `app.openapi()` (lazy import) |

Модули: [`knowledge/store.py`](../knowledge/store.py), [`resources.py`](resources.py). Auth: тот же Bearer JWT. Wiki отключается при `ASSISTANT_WIKI_ENABLED=false`.

### Пример JSON-RPC

```json
{ "jsonrpc": "2.0", "method": "resources/list", "params": {}, "id": 1 }
```

```json
{
  "jsonrpc": "2.0",
  "method": "resources/read",
  "params": { "uri": "openapi://v1" },
  "id": 2
}
```

## Tests

```bash
pytest tests/test_assistant_mcp_http.py -v
```

- `ASSISTANT_MCP_ENABLED=false` в `tests/conftest.py` для основного `app` (избежать singleton session manager).
- MCP-тесты используют изолированный `mcp_client` fixture.
- Требуется `Accept: application/json` на MCP POST (Streamable HTTP JSON mode).
