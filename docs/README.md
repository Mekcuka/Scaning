# Проект 2 - MVP Система поддержки принятия решений

## Описание

MVP системы поддержки принятия решений для нефтегазовой отрасли с:
- ГИС-картой **2D** (OpenLayers) и **3D** (MapLibre + Three.js) — `decision-matrix/frontend`
- Управлением проектами, POI, ставками и порогами
- Инфраструктурной матрицей сравнения точек интереса
- Анализом окружения и расчётом стоимости
- Схемой потоков (PFD), импортом (CSV, GeoJSON, KML, Shapefile, Искра, API)
- Одностраничниками (PDF print, PPTX)

**Актуальный статус кода:** [implementation-status.md](./implementation-status.md).

## Документация (`docs/`)

| Файл | Содержание |
|------|------------|
| [input-parameters.md](./input-parameters.md) | **Каталог исходных параметров ввода** (id, БД, UI) |
| [requirements.md](./requirements.md) | Функциональные требования (FR) |
| [auth-rbac.md](./auth-rbac.md) | **Аутентификация, RBAC, demo-учётки, troubleshooting** |
| [user-flows.md](./user-flows.md) | Пользовательские потоки (в т.ч. админ: журнал задач §5.3) |
| [architecture.md](./architecture.md) | Архитектура backend/frontend |
| [database-schema.md](./database-schema.md) | Схема БД |
| [calculation-logic-flow.md](./calculation-logic-flow.md) | Логика расчётов и матриц (диаграммы потоков) |
| [calculation-functions.md](./calculation-functions.md) | **Каталог расчётных функций** (формулы, входы/выходы) |
| [map-objects-and-spatial-calculations.md](./map-objects-and-spatial-calculations.md) | **Объекты карты, якоря расчёта, PostGIS** |
| [autoroad-network-plan.md](./autoroad-network-plan.md) | **Автосеть автодорог:** MST + Steiner, связность, BFF plan/apply, UI «Сеть» |
| [autoroad-network-instruction.md](./autoroad-network-instruction.md) | Пошаговая инструкция, JSON-контракт, **внешний API** (`:8001/v1/network/plan`) |
| [autoroad-network-planner/README.md](../autoroad-network-planner/README.md) | Standalone-пакет Python, `example_request.json`, Jupyter |
| [map-3d-features.md](./map-3d-features.md) | **3D-карта (реализовано):** glTF, custom GLB, линии, рельеф, L2/L3, cross-origin загрузка |
| [map-3d-plan.md](./map-3d-plan.md) | План внедрения 3D-карты (фазы, чеклисты) |
| [fluid-flow-schematic.md](./fluid-flow-schematic.md) | **Схема потоков (PFD)** — вкладка «Потоки», маршруты по сети, БКНС, пропускная способность |
| [implementation-status.md](./implementation-status.md) | **Статус реализации** (док ↔ код, навигация, пробелы) |
| [system-evolution-plan.md](./system-evolution-plan.md) | **План развития системы** (горизонты H0–H5; в начале файла — [версия простым языком](./system-evolution-plan.md#версия-для-руководителя-и-пользователей-без-it-терминов)) |
| [development-plan.md](./development-plan.md) | План разработки MVP (исторический чеклист) |
| [consistency-review.md](./consistency-review.md) | Ревизия согласованности документов |
| [spark-import-mapping.md](./spark-import-mapping.md) | Импорт проекта Искра |
| [testing-strategy.md](./testing-strategy.md) | Стратегия и покрытие тестами |

## Стек технологий

### Backend (Python/FastAPI)
- **FastAPI** - async web framework
- **SQLAlchemy 2.0** - async ORM
- **PostgreSQL + PostGIS** - база данных с геопространственными возможностями
- **Alembic** - миграции базы данных
- **JWT** - аутентификация (httpOnly cookies + CSRF + Bearer в `sessionStorage` на GitHub Pages, см. [auth-rbac.md](./auth-rbac.md))
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

Подробнее: [auth-rbac.md](./auth-rbac.md).

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
│   │   └── geo/               # Константы подтипов, PostGIS helpers
│   └── tests/                 # pytest (~140+ тестов)
└── frontend/                  # React 19 + Vite
    ├── package.json          # Зависимости npm
    ├── vite.config.ts        # Vite конфигурация
    ├── tailwind.config.js    # Tailwind конфигурация
    ├── tsconfig.json         # TypeScript конфигурация
    └── src/
        ├── main.tsx           # Точка входа
        ├── App.tsx            # Корневой компонент
        ├── lib/               # Utility функции
        ├── components/        # Компоненты
        │   ├── layout/        # Layout компоненты
        │   └── theme-provider.tsx
        └── pages/             # Login, Dashboard, Map, Matrix, Report, Import, Flows, Parameters, Admin, …
```

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
npm run test:e2e
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

