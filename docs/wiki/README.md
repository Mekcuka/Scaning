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

## Каталог статей (`articles/`)

| Slug | Файл | Тема |
|------|------|------|
| `navigation` | [navigation.md](articles/navigation.md) | Навигация по приложению |
| `map-2d` | [map-2d.md](articles/map-2d.md) | Карта 2D — забои, доп.стволы, слои |
| `pad-clustering-pywellgeo` | [pad-clustering-pywellgeo.md](articles/pad-clustering-pywellgeo.md) | **Кустование → PyWellGeo**, доп.стволы «До забоя» |
| `matrix` | [matrix.md](articles/matrix.md) | Матрица сравнения |
| `pad-earthwork-volumes` | [pad-earthwork-volumes.md](articles/pad-earthwork-volumes.md) | Земляные работы площадки |
| `pad-placement-optimization` | [pad-placement-optimization.md](articles/pad-placement-optimization.md) | **Оптимизация размещения кустов** (✅) |
| `parameters-earthwork` | [parameters-earthwork.md](articles/parameters-earthwork.md) | Параметры → Земляные работы |
| `parameters-footprint-connections` | [parameters-footprint-connections.md](articles/parameters-footprint-connections.md) | Точки подключения |
| `flows-overview` | [flows-overview.md](articles/flows-overview.md) | Потоки — технология и экономика |
| `logistics-overview` | [logistics-overview.md](articles/logistics-overview.md) | Логистика — схема и объёмы песка |
| `import-spark` | [import-spark.md](articles/import-spark.md) | Импорт данных и Искра |
| `import-3d` | [import-3d.md](articles/import-3d.md) | Импорт 3D |
| `background-jobs` | [background-jobs.md](articles/background-jobs.md) | Фоновые задачи |
| `assistant-chat` | [assistant-chat.md](articles/assistant-chat.md) | AI-помощник |
| `roles-rbac` | [roles-rbac.md](articles/roles-rbac.md) | Роли и доступ |
