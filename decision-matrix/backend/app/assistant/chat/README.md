# Assistant Chat (фаза 3)

In-process LLM chat: `POST /api/v1/assistant/chat` (JSON) и `POST /api/v1/assistant/chat/stream` (SSE) вызывают OpenAI-compatible API и **registry tools** без MCP wire protocol.

## Архитектура

```
React AssistantPanel
    → POST /api/v1/assistant/chat/stream  (fetch + ReadableStream)
    → orchestrator.py
        → tool_router.select_tools_for_chat()  (5–12 tools, не весь registry)
        → llm_client chat_completion (tool round)
        → registry.execute_tool()
        → response_formatters.try_server_answer_after_tools()  (фаза 7: без LLM)
        → llm_client chat_completion_stream (только если formatter не сработал)
```

`POST /assistant/chat` остаётся для совместимости и тестов (цельный `ChatResponse`).

Mutating tools (8 шт., см. [assistant-tools.md §8](../../../../docs/features/assistant-tools.md)) не выполняются сразу — API возвращает `pending_action` с `action_id`; подтверждение через `confirm_action_id` в следующем запросе. HTTP MCP для mutating возвращает `confirm_required`.

## UI-контекст (`ChatRequest`, фаза 8.3)

| Поле | Источник UI | Назначение |
|------|-------------|------------|
| `project_id` | `useActiveProject` | UUID активного проекта |
| `project_name` | `activeProject.name` | Имя для system prompt |
| `selected_poi_id` | Zustand `assistantUiContext` (синхронизация с карты/проекта/flows) | Выбранный POI |
| `active_tab` | `deriveActiveTab(pathname)` | Логический раздел (`map`, `matrix`, `flows/economic`, …) |
| `route_path` | `useLocation().pathname` | Полный путь страницы |

Frontend: [`assistantContext.ts`](../../../../frontend/src/lib/assistant/assistantContext.ts).

## Конфигурация (`app/core/config.py`)

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `ASSISTANT_CHAT_ENABLED` | `true` | `false` → 404 на `/chat`, status `enabled=false` |
| `ASSISTANT_LLM_BASE_URL` | `http://127.0.0.1:1234/v1` | OpenAI-compatible base (LM Studio, OpenRouter, OpenAI) |
| `ASSISTANT_LLM_API_KEY` | `lm-studio` | API key (LM Studio принимает любой непустой) |
| `ASSISTANT_LLM_MODEL` | `""` | Пусто = модель, загруженная в LM Studio |
| `ASSISTANT_LLM_TIMEOUT_SECONDS` | `120` | Таймаут HTTP к LLM |
| `ASSISTANT_CHAT_MAX_ROUTED_TOOLS` | `12` | Макс. tools в prompt LLM (категорийный роутинг) |
| `ASSISTANT_CHAT_MAX_TOOL_ROUNDS` | `8` | Макс. раундов tool-calling |
| `ASSISTANT_CHAT_MAX_TOOL_ROUNDS_VIEWER` | `4` | Лимит раундов для `viewer` |
| `ASSISTANT_CHAT_RATE_LIMIT_*` | viewer `10/min`, default `20/min`, admin `40/min` | Per-role slowapi на `/chat` |
| `ASSISTANT_MCP_RATE_LIMIT_*` | viewer `15/min`, default `30/min`, admin `60/min` | Per-role лимит HTTP MCP |

## Качество ответов (фаза 7)

### Роутинг tools (`tool_router.py`)

В prompt LLM попадает подмножество registry (default до 12 tools): вкладка UI (`active_tab`), ключевые слова в сообщении, core-set без `project_id` (`list_projects`, `get_me`), fallback если <3 tools. Приоритет read-tools (`list_infra_objects`, `list_pois`, …). **MCP не использует роутер** — полный набор tools.

Категории: `ToolDefinition.categories` — `session`, `projects`, `map`, `jobs`, `rates`, `analysis`, `flow`, `admin`.

### Server formatters (`response_formatters.py`)

После tool round `try_server_answer_after_tools()` проверяет intent + успешный tool и возвращает готовый русский текст. Покрыто: карта (`list_infra_objects`), проекты, POI, jobs, CAPEX/OPEX. Лейблы: `job_labels.py`, `rate_labels.py`, `infrastructure_subtypes.json`.

Тесты: `test_assistant_tool_router.py`, `test_assistant_response_formatters.py`, интеграция в `test_assistant_chat.py`.

## Audit log (фаза 9.3)

Каждый `execute_tool` пишет строку в `assistant_audit_log` (user, tool, args SHA-256, ok, code, source=`chat`|`mcp`|`confirm`). Admin: tool `admin_list_assistant_audit`, REST `GET /api/v1/admin/assistant/audit`.

## SSE streaming (`POST /assistant/chat/stream`)

Формат: `text/event-stream`, блоки `event: <type>\ndata: <json>\n\n`.

| event | data | Когда |
|-------|------|-------|
| `tool_start` | `{ "name": "list_projects" }` | Перед `execute_tool` |
| `tool_done` | `{ "name", "ok", "code"? }` | После `execute_tool` |
| `token` | `{ "delta": "..." }` | Финальный текст (server formatter или чанки LLM) |
| `pending_action` | `PendingAction` | Mutating tool (до `done`) |
| `done` | `ChatResponse` | Финал (message + tool_calls_made + pending_action) |
| `error` | `{ "message", "code"? }` | Ошибка; stream закрывается |

Раунды с `tool_calls` — non-stream `chat_completion`; только финальный текстовый раунд стримится (`chat_completion_stream`).

Пример событий:

```
event: tool_start
data: {"name": "list_projects"}

event: tool_done
data: {"name": "list_projects", "ok": true, "code": null}

event: token
data: {"delta": "Доступных проектов: **1**.\n\nПроекты:\n- Demo\n\nДанные из системы."}

event: done
data: {"message": {"role": "assistant", "content": "Доступных проектов: **1**.\n..."}, "tool_calls_made": [...], "pending_action": null}
```

UI: `postChatStream` в `assistantApi.ts` — POST + `X-CSRF-Token` + Bearer (не `EventSource`).

## LM Studio (локальная разработка)

1. Установите [LM Studio](https://lmstudio.ai/).
2. Загрузите модель с **tool calling** (например Qwen2.5, Llama 3.1+ instruct с function calling).
3. **Local Server** → Start → порт `1234`.
4. Backend на **том же ПК**: `python run_local.py` (или uvicorn).
5. `.env` / переменные:

```env
ASSISTANT_CHAT_ENABLED=true
ASSISTANT_LLM_BASE_URL=http://127.0.0.1:1234/v1
ASSISTANT_LLM_API_KEY=lm-studio
ASSISTANT_LLM_MODEL=local-model
```

Проверка LLM без UI:

```bash
curl http://127.0.0.1:1234/v1/models
```

Проверка status API (нужен login + CSRF как у остального `/api/v1`):

```bash
curl -b cookies.txt -H "X-CSRF-Token: ..." http://127.0.0.1:8000/api/v1/assistant/status
```

### Важно: localhost недоступен с prod VM

Если фронт на GitHub Pages, а backend на `erascaning.duckdns.org`, VM **не видит** `127.0.0.1:1234` на вашем ПК. Для prod задайте облачный провайдер в `/opt/decision-matrix/shared/app.env`:

```env
ASSISTANT_LLM_BASE_URL=https://openrouter.ai/api/v1
ASSISTANT_LLM_API_KEY=<secret>
ASSISTANT_LLM_MODEL=openai/gpt-4o-mini
```

## Prod (`app.env` на VM)

См. [DEPLOY.md](../../../../DEPLOY.md) — блок `ASSISTANT_LLM_*`.

`GET /api/v1/assistant/status` возвращает без секретов:

```json
{
  "enabled": true,
  "model": "qwen2.5:7b",
  "provider_ready": true,
  "base_url": "http://127.0.0.1:1234/v1",
  "mcp_url": "/api/v1/mcp/",
  "mcp_token_ttl_minutes": 60,
  "mcp_setup_hint_ru": "Для Cursor: выполните scripts/get-atlas-grid-token.ps1...",
  "llm_override": null
}
```

UI: badge при `!provider_ready`; collapsible «Подключение Cursor MCP» при `mcp_url`.

## Модули

| Файл | Назначение |
|------|------------|
| `schemas.py` | `ChatRequest`, `ChatResponse`, `PendingAction` |
| `sse.py` | `format_sse()`, `sse_response()` |
| `llm_client.py` | `chat_completion()`, `chat_completion_stream()`, `probe_provider()` |
| `orchestrator.py` | system prompt, tool loop, `run_chat_stream()`, confirm path |
| `tool_router.py` | `select_tools_for_chat()` — вкладка UI, keywords, core-set, cap 12 |
| `response_formatters.py` | server-side ответы после tools (infra, POI, jobs, тарифы, проекты) |
| `job_labels.py` / `rate_labels.py` | русские подписи job type/status и групп ставок |
| `pending.py` | HMAC-signed `action_id` для mutating confirm |
| `errors.py` | `ChatError` → HTTP 503 |

## Тесты

```bash
cd decision-matrix/backend
pytest tests/test_assistant_chat.py tests/test_assistant_tool_router.py tests/test_assistant_response_formatters.py -v
```

Mock `llm_client.chat_completion` — без реального LM Studio в CI.

## UI

`frontend/src/components/assistant/AssistantPanel.tsx` — иконка в header `AppLayout`, session-only история, карточка подтверждения для mutating tools.
