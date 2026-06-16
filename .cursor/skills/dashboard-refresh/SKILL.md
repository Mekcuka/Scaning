---
name: dashboard-refresh
description: >-
  Обновляет canvas-дашборд оркестрации свежими данными из docs/features/*/
  и .cursor/hooks/state/. Перечитывает артефакты конвейера (plan.md, contract.md,
  impl-log.md, review-report.md), определяет текущую роль/фазу каждой фичи,
  считает bugbot-loop и перезаписывает useCanvasState('features') в файле
  ~/.cursor/projects/c-Users-user-Documents-Cursore/canvases/orchestration-dashboard.canvas.tsx.
  Используй, когда пользователь просит обновить дашборд или жмёт кнопку Refresh.
---

# Dashboard Refresh: обновление canvas оркестрации

Перечитывает состояние конвейера и обновляет `INITIAL_FEATURES` в canvas-дашборде.

## Canvas-файл

`~/.cursor/projects/c-Users-user-Documents-Cursore/canvases/orchestration-dashboard.canvas.tsx`

Данные хранятся в `INITIAL_FEATURES` (inline-константа) и через `useCanvasState<Feature[]>("features", INITIAL_FEATURES)`. При обновлении **перезапиши `INITIAL_FEATURES`** — новое значение станет дефолтным при следующем открытии canvas.

## Порядок действий

### 1. Собери данные по фичам

Пройди по `docs/features/*/`. Для каждой директории определи:

```typescript
interface Feature {
  id: string;              // имя директории
  name: string;            // человекочитаемое (из первого H1 в .md)
  currentRole: "Planner" | "Builder" | "Reviewer" | "Integrator" | "Done";
  currentPhase: string;    // короткое описание текущего шага
  awaitingApproval: boolean;
  bugbotLoop: number;      // из .cursor/hooks/state/bugbot_loop.counter
  verdict: "none" | "green" | "red";
  lastUpdate: string;      // YYYY-MM-DD последнего .md
  docPath: string;         // путь к главному документу фичи
  notes: string;           // 1 строка
}
```

### 2. Алгоритм определения роли/фазы

Проверяй наличие файлов в порядке конвейера:

| Условие | currentRole | currentPhase |
|---------|-------------|--------------|
| Нет `plan.md` | Planner | "Артефакты планирования" |
| Есть `plan.md`, нет `contract.md` | Planner | "Пишу контракт" |
| Есть `plan.md` + `contract.md`, нет `impl-log.md` | Planner | "Готов к handoff Builder" |
| Есть `impl-log.md`, нет `review-report.md` | Builder | читай последнюю секцию `impl-log.md` |
| Есть `review-report.md`, verdict green, нет упоминания миграций/docker | Reviewer | "Ждёт Integrator" |
| Есть `review-report.md` green + миграции упоминаются | Integrator | "Интеграция" |
| `review-report.md` green + CI success упоминание | Done | "Завершено" |

**`awaitingApproval = true`** если:
- Planner: есть `plan.md` + `contract.md`, но нет `impl-log.md`
- Builder: в `impl-log.md` есть фраза «переходим к Reviewer?» или последняя фаза отмечена «завершено»
- Reviewer: `review-report.md` содержит «ЗЕЛЁНЫЙ» но нет миграций
- Integrator: упоминание «deploy ready» но нет «CI success»

### 3. Bugbot loop

Прочитай `.cursor/hooks/state/bugbot_loop.counter` (если файла нет — `0`).

### 4. Перезапиши canvas

Открой `orchestration-dashboard.canvas.tsx`, найди блок `const INITIAL_FEATURES: readonly Feature[] = [...]` и **полностью замени** его содержимое новым массивом. Сохраняя:
- Структуру объекта (все поля)
- Форматирование (отступы, кавычки)
- Комментарий «Стартовые данные (snapshot от ДАТА)» — обнови дату

### 5. Подтверждение пользователю

После обновления сообщи:

```
[Dashboard] Canvas обновлён.
- Фич проверено: N
- В конвейере: X
- Ждут approval: Y
- Красных: Z
Открой дашборд: ~/.cursor/projects/.../orchestration-dashboard.canvas.tsx
```

## Чтение артефактов

Для определения `name`, `notes`, `currentPhase` читай:
- Первый `# H1` в главном `.md` фичи → `name`
- Статус/дата в начале → `currentPhase`, `lastUpdate`
- Последняя секция `impl-log.md` → текущая фаза Builder
- `review-report.md` «Вердикт:» → `verdict`

## Источники данных

| Файл | Что берём |
|------|-----------|
| `docs/features/<f>/*.md` (все) | Наличие = прогресс фазы |
| `docs/features/<f>/impl-log.md` последняя секция | Фаза Builder |
| `docs/features/<f>/review-report.md` «Вердикт» | verdict green/red |
| `.cursor/hooks/state/bugbot_loop.counter` | bugbotLoop число |
| Дата `LastWriteTime` самого свежего `.md` | lastUpdate |

## Антипаттерны

- ❌ Удалять существующие фичи из массива при отсутствии изменений — сохраняй все
- ❌ Менять структуру `Feature` интерфейса — только значения
- ❌ Забывать обновить snapshot-дату в комментарии
- ❌ Читать `useCanvasState` вместо перезаписи `INITIAL_FEATURES` — дефолт должен быть актуальным
