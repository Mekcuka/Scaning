# Импорт данных проекта

**Дата:** июнь 2026  
**Маршрут:** `/data/import` (legacy `/import` → редирект)  
**Связанные документы:** [user-flows.md](../../product/user-flows.md) §2.1, [project-export.md](../import-export/project-export.md), [spark-import-mapping.md](../import-export/spark-import-mapping.md), [well-trajectory.md](../well-trajectory/well-trajectory.md), [implementation-status.md](../../planning/implementation-status.md)

---

## 1. Назначение

Страница **«Импорт»** загружает инфраструктуру и траектории скважин в **активный проект**: файлы (CSV, GeoJSON, KML, Shapefile), REST-подключения и инклинометрию (CSV / `.wbp`).

Раздел входит в группу **«Данные»** (`/data/*`) с подвкладками **Импорт**, **Экспорт**, **Импорт 3D** — layout как у «Параметры» (`DataLayout`, `parameters-subnav`).

---

## 2. Доступ

| Кто | Видит раздел | Может импортировать |
|-----|--------------|---------------------|
| admin, analyst, data_manager | да | да |
| viewer | нет | — |

Настройка: `NAV_VISIBILITY['/data/import']` в `lib/permissions.ts`. Пункт **«Данные»** в сайдбаре виден, если доступна хотя бы одна подвкладка (импорт, экспорт или импорт 3D).

---

## 3. Выбор проекта

На странице — панель **«Проект для импорта»** (`ImportProjectPanel`, стили `export-setup`):

- заголовок и подсказка;
- выпадающий список проектов справа.

Выбор синхронизируется с **глобальным** `currentProjectId` (Zustand). **Селектора проекта в шапке приложения нет** — заголовок страницы («Импорт данных») выводится в `app-header` через `usePageHeader` / `resolvePageHeader`.

---

## 4. Карточки импорта

Сетка **`export-grid`** и компонент **`ExportOptionCard`** (те же классы, что на экспорте: `export-page`, `export-option--*`).

| Карточка | Содержимое | Форматы / действия |
|----------|------------|-------------------|
| **Импорт файлов** | dropzone, превью dry-run, async-режим | CSV, GeoJSON, KML, ZIP (Shapefile) |
| **Подключение API** | форма REST, список подключений | Bearer, API Key; тест и синхронизация |
| **Импорт инклинометрии** | выбор куста, preview, commit | CSV, WBP; шаблон CSV |

На каждой карточке — счётчик (строк превью, число подключений, число кустов), теги форматов и кнопки в `export-option__actions`. Тело формы — в `export-option__body` (секции в режиме `embedded`).

Под карточками — блок **«История импорта»** (`ImportHistorySection`): таблица последних операций по проекту.

---

## 5. Фоновый импорт

При включённом async или больших объёмах (инклинометрия &gt;20 скв.) — job в очереди; на странице показывается прогресс-бар в info-алерте. Статус также в **журнале задач** в шапке.

---

## 6. Пустые состояния

- Нет проектов — алерт со ссылкой на «Проекты».
- Read-only (viewer на других экранах не попадает сюда) — карточки disabled с подсказкой.
- Нет выбранного проекта — карточки disabled: «Выберите проект…».

---

## 7. Код

| Путь | Роль |
|------|------|
| `frontend/src/components/layout/DataLayout.tsx` | подвкладки Данные |
| `frontend/src/pages/ImportPage.tsx` | UI страницы (карточки) |
| `frontend/src/pages/import/ImportProjectPanel.tsx` | выбор проекта |
| `frontend/src/pages/import/ImportFilesSection.tsx` | файлы + dropzone |
| `frontend/src/pages/import/ImportConnectionsSection.tsx` | REST API |
| `frontend/src/pages/import/ImportWellSurveysSection.tsx` | инклинометрия |
| `frontend/src/pages/import/ImportHistorySection.tsx` | журнал |
| `frontend/src/pages/import/useImportPageWorkflow.ts` | файлы + API + history |
| `frontend/src/pages/export/ExportOptionCard.tsx` | общие карточки (импорт + экспорт) |
| `frontend/src/styles/features/export.css` | `.export-page`, `.import-dropzone`, … |

Unit-тесты: `ImportPage.test.tsx`, `ImportPage.smoke.test.tsx`.

---

## 8. Не входит в scope

- Импорт 3D (custom GLB) — вкладка **Импорт 3D** (`/data/import-3d`).
- POI и ставки — отдельные экраны.
- Импорт Искра (SPARK) — тот же канал «Импорт файлов», см. [spark-import-mapping.md](../import-export/spark-import-mapping.md).
