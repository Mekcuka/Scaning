# Wiki Atlas Grid (для AI-помощника)

Короткие пользовательские статьи на русском для tools `search_wiki` / `get_wiki_article` и MCP resources `wiki://*`.

## Правила авторов

- Один файл — одна тема, 300–800 слов.
- Обязательный YAML frontmatter (см. пример ниже).
- Пишите для инженера/аналитика, не для разработчика: экраны, кнопки, типичные шаги.
- Не дублируйте целиком `docs/features/` — давайте выжимку; технические детали — ссылкой.
- После правок запустите синхронизацию bundle:

```powershell
python scripts/sync-assistant-wiki.py
```

Проверка без записи:

```powershell
python scripts/sync-assistant-wiki.py --check
```

## Формат frontmatter

```yaml
---
slug: map-2d
title: Карта 2D — объекты и слои
tags: [map, ui, layers]
tab_hints: [map]
roles: [viewer, analyst, admin, data_manager]
summary: Краткое описание в 1–2 предложения для поиска
---
```

- `slug` — уникальный идентификатор (`wiki://slug` в MCP).
- `roles` — кто видит статью; если пусто — все аутентифицированные роли.
- `tab_hints` — подсказка для контекста UI (вкладка `active_tab`).

## Runtime bundle

Статьи копируются в `decision-matrix/backend/app/assistant/knowledge/bundle/` (коммитится в репозиторий).
