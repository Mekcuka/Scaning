# Kaiten ↔ Scaning

Интеграция скрам-доски [Kaiten](https://wowa7777.kaiten.ru/space/798204/boards) с конвейером разработки Scaning (Planner → Builder → Reviewer → Integrator).

Документация API: [developers.kaiten.ru](https://developers.kaiten.ru/)

## Маппинг колонок

| Kaiten | Роли конвейера |
|--------|----------------|
| **Очередь** | Planner (планирование, ждёт approval → Builder) |
| **В работе** | Builder, Reviewer, Integrator |
| **Готово** | Done (integration-log + CI success) |

Фаза определяется по артефактам в `docs/features/<feature>/` — тот же алгоритм, что у canvas-дашборда оркестрации.

## API-ключ: один на всё

По [официальной документации](https://developers.kaiten.ru/) у Kaiten **один тип токена**:

```
Authorization: Bearer <token>
```

Отдельного «ключа только на чтение» и «ключа на запись» в API **нет**. Токен берётся в **Профиль → API** (на портале разработчиков — «Get bearer token» для вашего домена `wowa7777.kaiten.ru`).

Коды ответов при записи ([POST /cards](https://developers.kaiten.ru/cards/create-new-card)):

| Код | Значение по документации |
|-----|--------------------------|
| **401** | Невалидный токен |
| **402** | Функция недоступна на вашем **тарифе** |
| **403** | Forbidden — нет доступа к действию |
| **429** | Лимит 5 запросов/сек |

Если **GET работает**, а **POST/PATCH → 403** — это не «нужен другой ключ», а ограничение аккаунта/тарифа или прав на пространство. На [бесплатном тарифе](https://kaiten.ru/tariffs) после 14‑дневного пробного периода **интеграции (включая API)** отключаются; в UI карточки редактировать можно, через API — нет.

## Быстрый старт

### 1. Переменные окружения

```powershell
Copy-Item .env.example .env
# Вставьте ваш единственный KAITEN_API_TOKEN
```

```powershell
.\scripts\setup-kaiten.ps1 -ApiToken "ваш-токен"
```

### 2. Проверка (работает даже при 403 на запись)

```powershell
python scripts/sync-kaiten-features.py --status
python scripts/sync-kaiten-features.py --dry-run
```

### 4. Все задачи проекта на доску

```powershell
python scripts/sync-kaiten-features.py --export-all
```

Выгружает каталог из `scripts/kaiten/project_tasks.py` (~50+ карточек): backlog, in_progress, done. Реестр: `scripts/kaiten/tasks-registry.json`.

### 3a. Авто-sync (если API пишет)

```powershell
python scripts/sync-kaiten-features.py --init
python scripts/sync-kaiten-features.py
```

### 3b. Ручной режим (если API только читает — ваш случай)

```powershell
# Шаблоны карточек для копирования в UI
python scripts/sync-kaiten-features.py --print-manual

# Создайте карточки на доске вручную, скопируйте id из URL карточки
python scripts/sync-kaiten-features.py --link-card map3d-performance 12345678
python scripts/sync-kaiten-features.py --link-card websocket-journal 12345679

# Дальше sync попробует обновлять колонки (если 403 — смотрите статус и двигайте в UI)
python scripts/sync-kaiten-features.py --status
```

## Что создаётся в Kaiten

- **Заголовок:** `[Scaning] <название из plan.md>`
- **external_id:** `scaning:<feature-id>` — для повторного поиска
- **Описание:** роль, фаза, ссылка на `docs/features/`, GitHub
- **Комментарий** при смене фазы (если API разрешает запись)

Метаданные в репозитории: `docs/features/<feature>/kaiten.json`

## Когда запускать sync

| Событие | Команда |
|---------|---------|
| Planner завершил plan + contract | `--print-manual` или `--init` |
| Handoff Builder / Reviewer / Integrator | `sync-kaiten-features.py` или ручной перенос в UI |
| Integrator: CI green | `sync-kaiten-features.py` |
| Перед демо / стендап | `--status` |

## Если 403 не уходит

1. **Проверьте тариф** в Kaiten: пробный период (14 дней) vs бесплатный vs платный «Старт»+.
2. **Тот же токен** — перевыпустите в Профиль → API (не «другой ключ», а обновление).
3. **Напишите в поддержку** [support@kaiten.ru](mailto:support@kaiten.ru) — в документации указан этот канал для вопросов по интеграции.
4. **Рабочий обходной путь** — ручные карточки + `--link-card` + `--status` (фазы Scaning в терминале, доска в UI).

## Конфигурация

`scripts/kaiten.config.json` — доска, колонки, space_id (без секретов).

Секреты — только в `.env` (`KAITEN_API_TOKEN`).

## Безопасность

- Не коммитьте `.env` и API-ключи
- Ротируйте токен, если он попал в чат
- `kaiten.json` с `card_id` можно коммитить
