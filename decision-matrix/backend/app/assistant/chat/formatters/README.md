# Server-side response formatters (фаза 7.2+)

Детерминированные русские ответы чата после tool round — без второго вызова LLM.

## Поток

```
orchestrator._chat_events
  → execute_tool → tool_result_cache
  → registry.try_server_answer_after_tools()
       → (answer, answer_source) | (None, None)
  → если answer: ChatResponse + answer_source=formatter|tool_error
  → иначе: chat_completion (LLM) + answer_source=llm
```

`response_formatters.py` — тонкий re-export для обратной совместимости тестов.

## Реестр (`registry.py`)

`FormatterSpec(name, tool_names, match_fn, priority, tool_first)` — список `FORMATTER_SPECS`, порядок по `priority`.

| Модуль | Tools / сценарии |
|--------|------------------|
| `counts.py` | `list_projects`, `list_pois`, `list_infra_objects`, `list_infra_layers`, `get_project` |
| `jobs.py` | `get_project_job`, `list_project_jobs` |
| `rates.py` | `get_cost_rates`, `get_economic_params` |
| `analysis.py` | `get_poi_analysis`, `get_poi_candidates` |
| `admin.py` | `admin_list_jobs`, `admin_jobs_health` |
| `flow_sand.py` | `get_flow_schematic`, `get_economic_flow`, `get_sand_logistics_result` |
| `misc.py` | `get_me`, `get_assistant_status`, one-pagers, imports, networks, map3d; composite `list_projects`+`get_project_job` |
| `errors.py` | единственный failed tool → русское сообщение без LLM |

**Tool-first:** для list/count tools ответ формируется при успешном вызове, даже при слабом intent («сколько?»). Intent уточняет детализацию (полный список vs краткий счётчик).

**Исключение:** `list_infra_layers` не short-circuit'ит запрос на объекты карты — если пользователь спрашивает про инфраструктуру, а не слои.

## Labels

- `../job_labels.py`, `../rate_labels.py`, `../analysis_labels.py`
- `subtype_label_ru` — `shared/infrastructure_subtypes.json` (`_common.py`)

## Наблюдаемость

- `ChatResponse.answer_source`: `formatter` | `tool_error` | `llm`
- `GET /assistant/status`: `formatters_count`, `formatter_tools`

## Добавление formatter

1. `format_*` + `match_*` в подходящем модуле (или новый файл).
2. Запись в `registry._specs()` с `priority` и `tool_names`.
3. При list-tool — compact summary в `orchestrator._summarize_list_for_llm` при необходимости.
4. Unit в `tests/test_assistant_response_formatters.py`; при end-to-end — `tests/test_assistant_chat.py`.
5. Строка в [assistant-tools.md §10](../../../../docs/features/assistant/assistant-tools.md).

## Тесты

```bash
pytest tests/test_assistant_response_formatters.py tests/test_assistant_chat.py -v
```
