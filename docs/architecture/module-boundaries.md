# Границы модулей (SOLID, фаза 0)

> **План внедрения:** [solid-refactoring-plan.md](../planning/solid-refactoring-plan.md).  
> **Структура frontend после рефакторинга карты:** [frontend-structure.md](frontend-structure.md).  
> **Общая архитектура:** [architecture.md](architecture.md).

Документ фиксирует **целевые границы ответственности** слоёв Atlas Grid. Новый код и рефакторинг должны им соответствовать.

## Правила (обязательные)

1. **Один модуль — одна зона ответственности.** Файл не смешивает HTTP, бизнес-логику и SQL в одном слое.
2. **Лимит размера:** новый или существенно расширяемый файл — **≤ 300–400 строк**. Превышение только с обоснованием в PR.
3. **Barrel-экспорты:** при дроблении сохранять прежние публичные импорты (`lib/api`, `useMapPageOrchestrator`, `services/infrastructure_analysis`).
4. **Тонкие границы API:** страница/хук импортирует **узкий** доменный API, не весь `api`, если достаточно подмножества.
5. **Рефакторинг ≠ фича:** один PR — одна структурная цель.

---

## Backend (`decision-matrix/backend/app/`)

```
app/
├── api/v1/              # HTTP: валидация, auth, вызов service, response schema
│   ├── auth.py
│   ├── map.py             # compose map_* routers
│   ├── map_layers.py
│   ├── map_objects.py
│   ├── map_poi.py
│   ├── map_import.py
│   ├── map_deps.py
│   ├── projects.py      # projects, POI, rates (фаза 6 ✅)
│   ├── analysis.py      # POI analyze endpoints (фаза 6 ✅)
│   └── router.py        # только include_router
├── api/deps.py          # get_db, get_current_user, CSRF
├── api/rbac.py          # require_roles, project_access
├── core/                # config, security, middleware, DB session
├── models/              # SQLAlchemy ORM, enums
├── schemas/             # Pydantic request/response (если вынесены из api)
├── geo/                 # пространственные утилиты без бизнес-правил
└── services/            # бизнес-логика
    ├── calculations.py  # чистые функции, без БД
    ├── analysis/        # целевая декомпозиция (фаза 2)
    ├── spatial.py       # nearest, geodesic (кандидат на SpatialQueryPort, фаза 4)
    └── autoroad_network/
        └── planner_adapter.py  # адаптер внешнего planner
```

### Ответственность слоёв

| Слой | Может | Не может |
|------|-------|----------|
| `api/v1/*` | Парсить body, `Depends`, вызывать `services.*`, `HTTPException` | SQL-запросы, формулы расчёта, циклы по POI |
| `services/*` | Бизнес-правила, оркестрация, вызов `geo/`, `calculations` | Прямой доступ к `Request`, cookies |
| `services/calculations.py` | Чистые функции, `dataclass` | `AsyncSession`, HTTP, импорт `models` |
| `geo/*` | Геометрия, WKT, валидация координат | Ставки, статусы анализа, RBAC |
| `models/` | ORM, relationships | Бизнес-логика |
| `core/` | Инфраструктура приложения | Доменные правила нефтегаза |

### Зависимости (направление импортов)

```
api/v1  →  services, schemas, api/deps, api/rbac
services  →  models, geo, calculations, другие services
geo  →  (минимум: stdlib, shapely/postgis helpers)
models  →  только SQLAlchemy / enums
core  →  не импортирует services
```

**Запрещено:** `models` → `services`, `geo` → `services`, `calculations` → `models`.

### Handler (целевой шаблон)

```python
@router.post("/{project_id}/pois/{poi_id}/analyze")
async def analyze_poi(..., db: AsyncSession = Depends(get_db)):
    poi = await project_access.require_poi(...)
    return await analysis.run_poi_analysis(db, poi)
```

Handler: **≤ 15 строк**.

---

## Frontend (`decision-matrix/frontend/src/`)

```
src/
├── pages/               # Композиция layout; минимум логики
│   ├── map/             # UI-компоненты страницы карты
│   └── import/          # целевая структура Import (фаза 3)
├── components/          # Переиспользуемый UI; без прямых fetch
├── hooks/               # Состояние, эффекты, оркестрация
│   └── mapPageOrchestrator/
│       ├── actions/     # целевое дробление map actions (фаза 3)
│       └── ...
├── lib/
│   ├── api/             # HTTP-клиент и DTO
│   │   ├── client.ts    # request, errors
│   │   ├── *Api.ts      # доменные клиенты (фаза 1)
│   │   └── apiClient.ts # compose → export const api
│   ├── matrixData/      # представление матрицы (логика строк)
│   ├── permissions.ts   # RBAC на клиенте
│   └── ...
└── store/               # Глобальный UI-state (toast, refresh nonce)
```

### Ответственность слоёв

| Слой | Может | Не может |
|------|-------|----------|
| `pages/*` | Разметка, `useXxx`, передача props в `sections` | Прямые `fetch`, формулы анализа |
| `components/*` | Отображение, локальный UI-state | Знать о `projectId` из URL без props |
| `hooks/*` | Загрузка данных, мутации, координация | Разметка JSX (кроме мелких modal-хуков) |
| `lib/api/*` | HTTP, сериализация, типы DTO | Бизнес-правила матрицы/анализа |
| `lib/matrixData*` | Строки/ячейки матрицы из DTO | Прямой `fetch` |
| `store/` | Toast, nonce, UI prefs | Доменные расчёты |

### Зависимости (направление импортов)

```
pages  →  hooks, components, lib
hooks  →  lib/api, lib/*, store, другие hooks
components  →  lib (типы, форматтеры), hooks (редко)
lib/api  →  только client.ts, типы
lib/* (кроме api)  →  не импортирует pages, components
store  →  минимальные зависимости
```

**Запрещено:** `lib/api` → `pages`, `components` → `pages` (циклы), `lib/calculations` → `hooks`.

### Страница карты (эталон SRP)

Уже реализовано — **не нарушать** при доработках:

- `MapPage.tsx` — только layout + `{...sections.*}`
- `useMapPageOrchestrator` — композиция под-хуков
- `buildMapPageSections` — маппинг state → props дочерних компонентов

---

## Доменные модули (сквозная карта)

| Домен | Backend | Frontend | Примечание |
|-------|---------|----------|------------|
| Auth | `api/v1/auth.py`, `services/auth_tokens.py` | `LoginPage`, `lib/api/authApi` (цель) | JWT + CSRF |
| Projects / POI | `api/v1/projects.py`, `analysis.py` | `ProjectsPage`, `projectsApi` | Фаза 6 ✅ |
| Map | `api/v1/map.py`, `map_*.py`, `services/infra_create.py` | `MapPage`, `mapApi`, `mapPageOrchestrator` | map split ✅ |
| Analysis | `infrastructure_analysis.py` → `analysis/` | `MatrixPage`, `matrixData` | Фаза 2 / 5 |
| Import | `import_service.py`, `import_connections.py` | `ImportPage` → `pages/import/` | Фаза 3 |
| Autoroad | `autoroad_network/*`, `planner_adapter` | `useMapAutoroadNetwork` | DIP: planner port |
| Sand | `sand_logistics.py` | `sandLogisticsFlow/*` | Уже разбит |
| Flows PFD | `flow.py`, `fluid_flow_schematic.py` | `flowSchematicEditor/*` | Уже разбит |
| Jobs | `jobs.py`, `project_jobs.py` | `AdminJobsPage`, `jobsApi` | Async tasks |

---

## Куда класть новый код

| Задача | Куда |
|--------|------|
| Новый REST endpoint | `api/v1/<domain>.py` + `services/<domain>.py` + `lib/api/<domain>Api.ts` |
| Новая формула расчёта | `services/calculations.py` или `analysis/compute.py` + unit-тест |
| Новая строка матрицы | `lib/matrixData/sections.ts` — `MATRIX_SECTIONS` (см. `adding-infrastructure-subtype.md`) |
| Новый инструмент карты | `mapPageToolbar/`, хук в `hooks/`, не в `MapPage.tsx` |
| Новый subtype инфраструктуры | `cost_rates.py`, `subtypes.ts`, `sections.ts` — см. `docs/architecture/adding-infrastructure-subtype.md` |
| Интеграция внешнего сервиса | `services/*/adapter.py` (как `planner_adapter`) |

---

## Исключения из лимита 400 строк

Допустимы **временно** (с пометкой в PR и задачей на фазу плана):

| Файл | Причина | Целевая фаза |
|------|---------|--------------|
| ~~`apiClient.ts`~~ | compose (фаза 1 ✅) | — |
| ~~`infrastructure_analysis.py`~~ | barrel → `services/analysis/` (фаза 2 ✅) | — |
| `useMapPageMapActions.ts` | compose до разбиения | 3 |
| `buildMapPageSections.ts` | props mapping | 3 (опционально) |
| ~~`router.py`~~ | compose only (фаза 6 ✅) | — |

Новый код **не добавляется** в эти файлы сверх мелких правок; расширение — через новые модули или следующую фазу плана.

---

## Чеклист ревью (краткий)

При ревью PR сверяться с этим документом:

1. Код лежит в правильном слое (таблицы «Может / Не может»).
2. Импорты не нарушают направление зависимостей.
3. Размер файла ≤ 400 строк или есть исключение из таблицы выше.
4. Публичные barrel-импорты сохранены.
5. Документация обновлена, если изменились пути или границы.

Полный чеклист: [solid-refactoring-plan.md § Чеклист PR](../planning/solid-refactoring-plan.md#чеклист-pr-рефакторинга).
