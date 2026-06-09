# Dev stdio MCP (фаза 4)

Локальный MCP-сервер для Cursor: pytest, поиск по репозиторию, git. **Не** деплоится на VM и **не** входит в HTTP `/api/v1/mcp/`.

## Tools

| Tool | Описание |
|------|----------|
| `run_pytest_tool` | `pytest` в `decision-matrix/backend` (sandbox path) |
| `search_codebase_tool` | Поиск по коду (`rg` или Python fallback) |
| `git_status_tool` | `git status --short` + текущая ветка |
| `git_log_tool` | `git log --oneline` |

Domain tools (проекты, POI, jobs) — по умолчанию через HTTP MCP **`atlas-grid`**. Опционально read-only proxy в этом сервере (фаза 9.6).

## Запуск вручную

```powershell
cd decision-matrix\backend
.\venv\Scripts\Activate.ps1
python -m app.assistant.dev.stdio_mcp
```

Процесс ждёт stdio (для Cursor). В терминале «висит» — это нормально.

## Cursor setup

### Вариант A — скрипт (рекомендуется)

Из корня репозитория:

```powershell
.\scripts\get-atlas-grid-token.ps1 -IncludeDevMcp
```

Добавит `atlas-grid` (HTTP + JWT) и `atlas-grid-dev` (stdio).

### Вариант B — вручную

Скопируйте блок `atlas-grid-dev` из [`.cursor/mcp.json.example`](../../../../.cursor/mcp.json.example), подставьте абсолютные пути к `venv\Scripts\python.exe` и `decision-matrix/backend`.

Cursor → **Settings → Tools & MCP → Reload**.

## Конфигурация

| Переменная | Default | Описание |
|------------|---------|----------|
| `ASSISTANT_DEV_MCP_ENABLED` | `true` | `false` — entrypoint exit 1 |
| `ASSISTANT_DEV_MCP_DOMAIN_TOOLS` | `false` | `true` — регистрация read-only domain tools из registry (без mutating) |
| `ASSISTANT_DEV_MCP_USER_EMAIL` | `admin@test.ru` | Пользователь SQLite для domain proxy |
| `ASSISTANT_DEV_MCP_REPO_ROOT` | `""` | Пусто = auto-detect monorepo root |

Guard: `ENVIRONMENT=production` — dev MCP не стартует.

## Безопасность

- Пути проверяются через `sandbox.py` (только внутри repo; deny `.env`, `venv`, `node_modules`)
- `run_pytest` — только под `backend/`
- Subprocess без `shell=True`, с timeout

## Тесты

```bash
cd decision-matrix/backend
pytest tests/test_assistant_dev_mcp.py -v
```

## Модули

| Файл | Назначение |
|------|------------|
| `stdio_mcp.py` | FastMCP entrypoint |
| `repo_root.py` | Поиск корня репо / backend |
| `sandbox.py` | Ограничение путей |
| `tools/pytest_tool.py` | run_pytest |
| `tools/search.py` | search_codebase |
| `tools/git_tool.py` | git_status, git_log |
