# HTTP MCP transport (Streamable HTTP)

Mount point: **`/api/v1/mcp`** (see `ASSISTANT_MCP_PATH` in `app/core/config.py`).

## Architecture

```
POST /api/v1/mcp
  → McpAuthMiddleware (Bearer JWT required)
  → FastMCP (stateless Streamable HTTP)
  → app/assistant/registry.py (list_tools / execute_tool)
  → app/services/*
```

Implementation: [`auth.py`](auth.py), [`http_mcp.py`](http_mcp.py). Wired in [`app/main.py`](../../main.py) via `mount_assistant_mcp(app)` and combined lifespan (`mcp_lifespan()`).

## Configuration

| Env / setting | Default | Description |
|---------------|---------|-------------|
| `ASSISTANT_MCP_ENABLED` | `true` | Set `false` to disable mount (e.g. isolated prod) |
| `ASSISTANT_MCP_PATH` | `/api/v1/mcp` | ASGI mount path |

## Local development (Cursor)

1. Start backend: `python run_local.py` (port 8000).
2. Login via REST: `POST /api/v1/auth/login` → copy `access_token`.
3. Add to Cursor MCP settings (do not commit tokens):

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

Production URL: `https://erascaning.duckdns.org/api/v1/mcp`

## Tests

```bash
pytest tests/test_assistant_mcp_http.py -v
```

Requires `Accept: application/json` on MCP POST requests (Streamable HTTP JSON mode).
