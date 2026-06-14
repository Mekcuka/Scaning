# Проект 2 - MVP Система поддержки принятия решений

## Описание

MVP системы поддержки принятия решений для нефтегазовой отрасли с:
- ГИС-картой **2D** (OpenLayers) и **3D** (MapLibre + Three.js) — `decision-matrix/frontend`
- Управлением проектами, POI, ставками и порогами
- Инфраструктурной матрицей сравнения точек интереса
- Анализом окружения и расчётом стоимости
- Схемой потоков (PFD), импортом (CSV, GeoJSON, KML, Shapefile, Искра, API)
- Одностраничниками (PDF print, PPTX)

**Актуальный статус кода:** [implementation-status.md](planning/implementation-status.md).

## Документация (`docs/`)

### Wiki для AI-помощника — [`wiki/`](wiki/)

| Файл | Содержание |
|------|------------|
| [wiki/README.md](wiki/README.md) | Правила авторов, sync в backend bundle |
| [wiki/articles/](wiki/articles/) | Короткие how-to статьи (навигация, карта, матрица, импорт, земляные работы, параметры площадки, …) |

### Продукт и требования — [`product/`](product/)

| Файл | Содержание |
|------|------------|
| [requirements.md](product/requirements.md) | Функциональные требования (FR) |
| [user-flows.md](product/user-flows.md) | Пользовательские потоки (в т.ч. админ: журнал задач §5.3) |
| [input-parameters.md](product/input-parameters.md) | **Каталог исходных параметров ввода** (id, БД, UI) |

### Архитектура — [`architecture/`](architecture/)

| Файл | Содержание |
|------|------------|
| [architecture.md](architecture/architecture.md) | Архитектура backend/frontend |
| [frontend-structure.md](architecture/frontend-structure.md) | **Структура frontend** (MapPage, MapView, api) |
| [ui-guidelines.md](architecture/ui-guidelines.md) | **UI guidelines** — токены, `styles/`, panelUi, BEM, чеклист |
| [database-schema.md](architecture/database-schema.md) | Схема БД |
| [auth-rbac.md](architecture/auth-rbac.md) | **Аутентификация, RBAC**, demo-учётки, troubleshooting |
| [assistant.md](architecture/assistant.md) | **AI Assistant:** Shared Tool Registry, MCP, чат, фазы 2–9; §16 — роутинг tools и реестр formatters (фаза 7) |

### Функциональные модули — [`features/`](features/)

| Файл | Содержание |
|------|------------|
| [map-objects-and-spatial-calculations.md](features/map-objects-and-spatial-calculations.md) | **Объекты карты**, якоря расчёта, PostGIS |
| [map-3d-features.md](features/map-3d-features.md) | **3D-карта (реализовано):** glTF, custom GLB, линии, рельеф |
| [map-3d-plan.md](features/map-3d-plan.md) | План внедрения 3D-карты (фазы, чеклисты) |
| [fluid-flow-schematic.md](features/fluid-flow-schematic.md) | **Схема потоков (PFD)** — вкладка «Потоки» |
| [economic-flow-schematic.md](features/economic-flow-schematic.md) | Экономическая схема потоков |
| [task-log-panel.md](features/task-log-panel.md) | Журнал задач в шапке приложения |
| [project-import.md](features/project-import.md) | Импорт данных (`/data/import`): карточки, API, инклинометрия |
| [project-export.md](features/project-export.md) | Экспорт координат и GeoJSON (`/data/export`): выбор проекта, карточки форматов |
| [assistant-tools.md](features/assistant-tools.md) | **AI Assistant:** каталог 39 shared tools, MCP, чат, роутинг/formatters (фаза 7), mutating/audit (фазы 1–9) |
| [spark-import-mapping.md](features/spark-import-mapping.md) | Импорт проекта Искра |
| [pad-earthwork.md](features/pad-earthwork.md) | **Земляные работы куста:** объёмы, DEM, генератор раскладки устьев |
| [well-trajectory.md](features/well-trajectory.md) | **Траектории и «Кустование»:** design, SF, 3D (M1–M3 ✅) |
| [pad-placement-optimization.md](features/pad-placement-optimization.md) | **Оптимизация размещения кустов** (✅): greenfield по забоям, M2+ перебор центра по Σ MD |

### Автосеть автодорог — [`autoroad/`](autoroad/)

| Файл | Содержание |
|------|------------|
| [autoroad-network-plan.md](autoroad/autoroad-network-plan.md) | **Автосеть:** MST + Steiner, BFF plan/apply, UI «Сеть» |
| [autoroad-network-instruction.md](autoroad/autoroad-network-instruction.md) | Пошаговая инструкция, JSON-контракт, внешний API |
| [autoroad-network-planner/README.md](../autoroad-network-planner/README.md) | Standalone-пакет Python, `example_request.json`, Jupyter |

### Расчёты — [`calculations/`](calculations/)

| Файл | Содержание |
|------|------------|
| [calculation-logic-flow.md](calculations/calculation-logic-flow.md) | Логика расчётов и матриц (диаграммы потоков) |
| [calculation-functions.md](calculations/calculation-functions.md) | **Каталог расчётных функций** (формулы, входы/выходы) |

### Планы и статус — [`planning/`](planning/)

| Файл | Содержание |
|------|------------|
| [implementation-status.md](planning/implementation-status.md) | **Статус реализации** (док ↔ код, навигация, пробелы) |
| [system-evolution-plan.md](planning/system-evolution-plan.md) | **План развития** (горизонты H0–H5; [версия простым языком](planning/system-evolution-plan.md#версия-для-руководителя-и-пользователей-без-it-терминов)) |
| [development-plan.md](planning/development-plan.md) | План разработки MVP (исторический чеклист) |
| [consistency-review.md](planning/consistency-review.md) | Ревизия согласованности документов |
| [well-trajectory-roadmap.md](planning/well-trajectory-roadmap.md) | Roadmap траекторий (M1–M4) |
| [pad-placement-optimization-plan.md](planning/pad-placement-optimization-plan.md) | **План:** оптимизация размещения кустов (D0–M5) |
| [pad-placement-optimization-data-model.md](planning/pad-placement-optimization-data-model.md) | Модель данных pad-placement |

### Тестирование — [`testing/`](testing/)

| Файл | Содержание |
|------|------------|
| [testing-strategy.md](testing/testing-strategy.md) | Стратегия и покрытие тестами |

### Деплой — [`deploy/`](deploy/) и [DEPLOY.md](../DEPLOY.md)

| Файл | Содержание |
|------|------------|
| [DEPLOY.md](../DEPLOY.md) | GitHub Pages + Yandex VM, secrets, smoke-check |
| [map3d-models-storage.md](deploy/map3d-models-storage.md) | **Custom GLB на VM:** volume `map3d_models`, one-time setup, бэкап, troubleshooting |

## Стек технологий

### Backend (Python/FastAPI)
- **FastAPI** - async web framework
- **SQLAlchemy 2.0** - async ORM
- **PostgreSQL + PostGIS** - база данных с геопространственными возможностями
- **Alembic** - миграции базы данных
- **JWT** - аутентификация (httpOnly cookies + CSRF + Bearer в `sessionStorage` на GitHub Pages, см. [auth-rbac.md](architecture/auth-rbac.md))
- **Pydantic** - валидация данных
- **NumPy** - матричные вычисления
- **python-pptx** - генерация PPTX
- **slowapi** - rate limiting

> Импорт в фоне: `asyncio` + `schedule_async_import` (не Celery). Post-MVP: Celery + Redis, server-side PDF (WeasyPrint).

### Frontend
- **React 19** - UI библиотека
- **TypeScript** - типизация
- **Vite** - сборщик
- **Tailwind CSS** - стилизация
- **TanStack Query** - управление состоянием сервера
- **Zustand** - управление состоянием клиента
- **OpenLayers** — GIS-клиент 2D (`decision-matrix/frontend`)
- **MapLibre GL JS + Three.js** — режим 3D просмотра (`MapView3D`, `lib/map3d/`)
- **Recharts** - графики
- **Lucide React** - иконки
- **React Hook Form + Zod** - формы и валидация

## Быстрый старт

Подробные инструкции по запуску приложения: [`../decision-matrix/README.md`](../decision-matrix/README.md).

### Требования
- Python 3.11+
- Node.js 20+

### Два режима базы данных
- **SQLite** — быстрый старт (`python run_local.py` в `decision-matrix/backend`)
- **PostgreSQL + PostGIS** — полная поддержка карты (FR-2)

### Доступ к приложению

- **Frontend**: http://127.0.0.1:5173
- **Backend API**: http://localhost:8000/api/v1
- **Swagger**: http://localhost:8000/api/v1/docs

**Демо-учётки** (после `run_local.py` или `seed.py`):

| Email | Пароль | Роль |
|-------|--------|------|
| `engineer@oilgas.ru` | `password123` | analyst |
| `admin@oilgas.ru` | `admin1234` | admin |
| `data@oilgas.ru` | `data12345` | data_manager |
| `viewer@oilgas.ru` | `viewer123` | viewer |

Подробнее: [auth-rbac.md](architecture/auth-rbac.md).

### Локальная разработка

#### Backend (SQLite)
```bash
cd decision-matrix/backend
python -m venv venv
source venv/bin/activate   # Linux/Mac
# venv\Scripts\activate    # Windows
pip install -r requirements.txt
python run_local.py
```

#### Backend (PostgreSQL + PostGIS)
```bash
cd decision-matrix/backend
cp .env.example .env
# отредактируйте DATABASE_URL в .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
python seed.py
```

#### Frontend
```bash
cd decision-matrix/frontend
npm install
npm run dev
```

## Структура проекта

```
decision-matrix/
├── README.md                  # Запуск и API
├── backend/                   # Backend приложение (Python/FastAPI)
│   ├── run_local.py           # SQLite: init + seed + uvicorn
│   ├── .env.example
│   ├── requirements.txt
│   ├── alembic/               # Миграции базы данных
│   │   ├── env.py
│   │   └── versions/
│   ├── app/
│   │   ├── main.py            # Точка входа FastAPI
│   │   ├── core/              # Core функционал
│   │   │   ├── config.py      # Конфигурация
│   │   │   ├── database.py    # SQLAlchemy async engine
│   │   │   ├── security.py    # JWT, хеширование паролей
│   │   ├── api/               # API endpoints
│   │   │   ├── v1/
│   │   │   │   ├── router.py  # Projects, POI, rates
│   │   │   │   ├── auth.py, admin.py, map.py
│   │   │   │   ├── flow.py, graph.py, one_pagers.py
│   │   │   │   └── import_connections.py, sand_logistics.py
│   │   │   ├── rbac.py, deps.py
│   │   ├── models/            # SQLAlchemy модели
│   │   ├── schemas/           # Pydantic схемы
│   │   ├── services/          # Бизнес-логика (analysis, import, flow, …)
│   │   ├── assistant/         # Shared Tool Registry (AI / MCP, фаза 1)
│   │   └── geo/               # Константы подтипов, PostGIS helpers
│   └── tests/                 # pytest (~140+ тестов)
└── frontend/                  # React 19 + Vite
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx, App.tsx
        ├── pages/
        │   ├── MapPage.tsx           # оркестратор /map (~981 строк)
        │   └── map/                  # MapPageToolbar, Canvas, SidePanels, …
        ├── components/
        │   ├── MapView.tsx           # обёртка 2D (~58 строк)
        │   ├── mapView/              # OpenLayers init + hooks
        │   ├── ObjectDetailPanel.tsx
        │   ├── objectDetailPanel/
        │   └── MapView3D.tsx, layout/, …
        ├── hooks/                    # useMap*, useProjectData, useActiveProject
        └── lib/
            ├── api.ts                # barrel → api/*
            ├── api/                  # apiClient, entities, subtypes, …
            └── map3d/                 # 3D custom layers
```

Подробнее: [frontend-structure.md](architecture/frontend-structure.md).

## API Endpoints

Полный перечень и группы — [decision-matrix/README.md](../decision-matrix/README.md) и Swagger `/api/v1/docs`.

**Реализовано:** auth, admin, projects, POI, rates, distance-defaults, economic-params, infrastructure (layers/objects), analysis/candidates, import (csv/geojson/kml/shapefile/spark + async), import_connections, import_logs, one-pagers (+ pptx), flow-schematic, infrastructure/networks, sand-logistics.

**Legacy (не в UI):** универсальные `decision_matrices` / TOPSIS — см. FR-14.1.3.

## Разработка

### Backend

```bash
cd decision-matrix/backend

# Установка зависимостей
pip install -r requirements.txt -r requirements-dev.txt

# Локальный SQLite + seed
python run_local.py

# PostgreSQL + PostGIS
uvicorn app.main:app --reload

# Линтинг
ruff check .
ruff format --check .

# Тесты
pytest tests/ -q
```

### Frontend

```bash
cd decision-matrix/frontend

# Установка зависимостей
npm ci

# Запуск dev сервера
npm run dev

# Сборка для продакшена
npm run build

# Предпросмотр сборки
npm run preview

# Линтинг и проверки
npm run lint
npm run typecheck
npm run test
npm run test:e2e   # backend на :8000; после прогона — автоочистка test_* / e2e-* (см. testing-strategy.md)
```

### База данных

```bash
cd decision-matrix/backend

# Создание новой миграции
alembic revision --autogenerate -m "description"

# Применение миграций
alembic upgrade head

# Откат миграции
alembic downgrade -1

# Просмотр истории миграций
alembic history
```

## Лицензия

MIT

