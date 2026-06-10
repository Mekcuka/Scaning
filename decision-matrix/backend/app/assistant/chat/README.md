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
        → formatters/registry.try_server_answer_after_tools()  (фаза 7: без LLM)
        → llm_client chat_completion / stream (только если formatter не сработал)
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

### Server formatters (`formatters/`)

После tool round `try_server_answer_after_tools()` возвращает `(answer, answer_source)`. Реестр `FormatterSpec` в [`formatters/registry.py`](formatters/registry.py): tool-first для list/count, анализ POI, admin jobs, потоки/песок, misc read-tools, ответ при единственной ошибке tool.

`ChatResponse.answer_source`: `formatter` | `tool_error` | `llm`. Список покрытых tools: `GET /assistant/status` → `formatter_tools`.

Подробнее: [`formatters/README.md`](formatters/README.md), [assistant-tools.md §10](../../../../docs/features/assistant-tools.md).

Тесты: `test_assistant_tool_router.py`, `test_assistant_response_formatters.py`, интеграция в `test_assistant_chat.py`.

## Audit log (фаза 9.3)

Каждый `execute_tool` пишет строку в `assistant_audit_log` (user, tool, args SHA-256, ok, code, source=`chat`|`mcp`|`confirm`). Admin: tool `admin_list_assistant_audit`, REST `GET /api/v1/admin/assistant/audit`.

## SSE streaming (`POST /assistant/chat/stream`)

Формат: `text/event-stream`, блоки `event: <type>\ndata: <json>\n\n`.

| event | data | Когда |
|-------|------|-------|
| `tool_start` | `{ "name": "list_projects" }` | Перед `execute_tool` |
| `tool_done` | `{ "name", "ok", "code"? }` | После `execute_tool` |
| `token` | `{ "delta": "..." }` | Финальный ответ (formatter или чанки LLM) |
| `reasoning_token` | `{ "delta": "..." }` | Размышления модели (скрыты в UI по умолчанию) |
| `pending_action` | `PendingAction` | Mutating tool (до `done`) |
| `done` | `ChatResponse` | Финал (message + tool_calls_made + pending_action + answer_source?) |
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
data: {"message": {"role": "assistant", "content": "Доступных проектов: **1**.\n..."}, "tool_calls_made": [...], "pending_action": null, "answer_source": "formatter"}
```

UI: `postChatStream` в `assistantApi.ts` — POST + `X-CSRF-Token` + Bearer (не `EventSource`).

## LLM-провайдеры (локально и облако)

Один клиент [`llm_client.py`](llm_client.py) — OpenAI-compatible HTTP. Примеры в [`.env.example`](../../.env.example).

| Провайдер | `ASSISTANT_LLM_BASE_URL` | Примечание |
|-----------|--------------------------|------------|
| **Ollama** | `http://127.0.0.1:11434/v1` | `ollama pull qwen2.5:7b`, `ollama serve` |
| **LM Studio** | `http://127.0.0.1:1234/v1` | модель с **function calling**, Local Server |
| **OpenRouter** | `https://openrouter.ai/api/v1` | ключ на openrouter.ai; для free — суффикс `:free` |

Для OpenRouter backend добавляет заголовки `HTTP-Referer` и `X-OpenRouter-Title` (требование провайдера).

### LM Studio (локальная разработка)

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

### OpenRouter (облако, в т.ч. локальный backend)

```env
ASSISTANT_LLM_BASE_URL=https://openrouter.ai/api/v1
ASSISTANT_LLM_API_KEY=<your-key>
ASSISTANT_LLM_MODEL=nvidia/nemotron-nano-9b-v2:free
```

**Важно:** `GET /models` может отвечать `200` (`provider_ready=true`), а `POST /chat/completions` — **`429 Too Many Requests`** на бесплатных моделях (лимит OpenRouter). Это не «сломанный LM Studio» — смените модель, подождите или добавьте кредиты.

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
  "llm_override": null,
  "formatters_count": 20,
  "formatter_tools": ["list_projects", "list_pois", "..."],
  "wiki_enabled": true,
  "wiki_articles_count": 8
}
```

UI: badge при `!provider_ready`; подсказка о недоступном LLM зависит от `base_url` (Ollama / LM Studio / OpenRouter), см. [`chatErrors.ts`](../../../../frontend/src/lib/assistant/chatErrors.ts); collapsible «Подключение Cursor MCP» при `mcp_url`.

## Ошибки LLM и SSE `error`

`ChatError` в [`errors.py`](errors.py) → SSE `event: error` с полями `message`, `code` → HTTP 503 на non-stream `/chat`.

| `code` | Причина | Что делать |
|--------|---------|------------|
| `llm_rate_limit` | HTTP 429 от провайдера | Подождать; сменить модель; на OpenRouter — кредиты или другая `:free` модель |
| `llm_auth` | HTTP 401/403 | Проверить `ASSISTANT_LLM_API_KEY`, перезапустить backend |
| `llm_connection` | Сеть / провайдер не запущен | Ollama `serve`, LM Studio Local Server, URL в `.env` |
| `llm_config` | Пустой `ASSISTANT_LLM_BASE_URL` | Заполнить `ASSISTANT_LLM_*` |
| `llm_timeout` | Таймаут `ASSISTANT_LLM_TIMEOUT_SECONDS` | Короче запрос или больше таймаут |
| `llm_http` | Прочие 4xx/5xx | Текст от провайдера в `message` |

`probe_provider()` только проверяет `GET …/models` (статус «провайдер доступен»), но **не** гарантирует успешный chat completion.

## Модули

| Файл | Назначение |
|------|------------|
| `schemas.py` | `ChatRequest`, `ChatResponse`, `PendingAction` |
| `sse.py` | `format_sse()`, `sse_response()` |
| `llm_client.py` | `chat_completion()`, `chat_completion_stream()`, `probe_provider()`, `_chat_error_for_http()` |
| `orchestrator.py` | system prompt, tool loop, `run_chat_stream()`, confirm path |
| `tool_router.py` | `select_tools_for_chat()` — вкладка UI, keywords, core-set, cap 12 |
| `formatters/` | реестр server-side ответов после tools (см. `formatters/README.md`) |
| `response_formatters.py` | re-export для обратной совместимости |
| `job_labels.py` / `rate_labels.py` / `analysis_labels.py` | русские подписи jobs, ставок, статусов анализа |
| `pending.py` | HMAC-signed `action_id` для mutating confirm |
| `errors.py` | `ChatError` → HTTP 503 / SSE `error` |

## Тесты

```bash
cd decision-matrix/backend
pytest tests/test_assistant_chat.py tests/test_assistant_tool_router.py tests/test_assistant_response_formatters.py -v
```

Mock `llm_client.chat_completion` — без реального LM Studio в CI.

## UI

`frontend/src/components/assistant/AssistantPanel.tsx` — иконка в header `AppLayout`, session-only история, карточка подтверждения для mutating tools.
