# Проект 2 - MVP Система поддержки принятия решений

## Описание

MVP системы поддержки принятия решений для нефтегазовой отрасли с:
- ГИС-картой (**OpenLayers**, приложение `decision-matrix/frontend`)
- Управлением проектами инфраструктуры
- Инфраструктурной матрицей сравнения точек интереса
- Анализом окружения точек интереса
- Расчётом стоимости вариантов реализации

## Документация (`docs/`)

| Файл | Содержание |
|------|------------|
| [input-parameters.md](./input-parameters.md) | **Каталог исходных параметров ввода** (id, БД, UI) |
| [requirements.md](./requirements.md) | Функциональные требования (FR) |
| [auth-rbac.md](./auth-rbac.md) | **Аутентификация, RBAC, demo-учётки, troubleshooting** |
| [user-flows.md](./user-flows.md) | Пользовательские потоки |
| [architecture.md](./architecture.md) | Архитектура backend/frontend |
| [database-schema.md](./database-schema.md) | Схема БД |
| [calculation-logic-flow.md](./calculation-logic-flow.md) | Логика расчётов и матриц (диаграммы потоков) |
| [calculation-functions.md](./calculation-functions.md) | **Каталог расчётных функций** (формулы, входы/выходы) |
| [map-objects-and-spatial-calculations.md](./map-objects-and-spatial-calculations.md) | **Объекты карты, якоря расчёта, PostGIS** |
| [map-3d-features.md](./map-3d-features.md) | **3D-карта (реализовано):** glTF, линии, рельеф, L2/L3, env |
| [map-3d-plan.md](./map-3d-plan.md) | План внедрения 3D-карты (фазы, чеклисты) |
| [fluid-flow-schematic.md](./fluid-flow-schematic.md) | **Схема потоков (PFD)** — вкладка «Потоки», маршруты по сети, БКНС, пропускная способность |
| [development-plan.md](./development-plan.md) | План разработки MVP |
| [consistency-review.md](./consistency-review.md) | Ревизия согласованности документов |

## Стек технологий

### Backend (Python/FastAPI)
- **FastAPI** - async web framework
- **SQLAlchemy 2.0** - async ORM
- **PostgreSQL + PostGIS** - база данных с геопространственными возможностями
- **Alembic** - миграции базы данных
- **Celery + Redis** - асинхронные задачи
- **JWT** - аутентификация (httpOnly cookies + CSRF, см. [auth-rbac.md](./auth-rbac.md))
- **Pydantic** - валидация данных
- **NumPy** - матричные вычисления
- **WeasyPrint** - генерация PDF
- **python-pptx** - генерация PPTX

### Frontend
- **React 18** - UI библиотека
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
│   │   │   └── celery_app.py  # Celery конфигурация
│   │   ├── api/               # API endpoints
│   │   │   ├── v1/
│   │   │   │   ├── api.py     # Главный роутер
│   │   │   │   ├── endpoints/ # Конечные точки
│   │   │   │   └── deps.py    # Зависимости
│   │   ├── models/            # SQLAlchemy модели
│   │   ├── schemas/           # Pydantic схемы
│   │   ├── services/          # Бизнес-логика
│   │   └── tasks/             # Celery задачи
│   └── tests/                 # Тесты
└── frontend/                  # Frontend приложение (React/Vite)
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
        └── pages/             # Страницы
            ├── LoginPage.tsx
            ├── DashboardPage.tsx
            ├── ProjectsPage.tsx
            ├── ProjectDetailPage.tsx
            └── MapPage.tsx
```

## API Endpoints

### Auth (реализовано)
- `POST /api/v1/auth/register` - Регистрация (role=analyst)
- `POST /api/v1/auth/login` - Вход (Set-Cookie)
- `POST /api/v1/auth/refresh` - Обновление токена (rotation)
- `POST /api/v1/auth/logout` - Выход (revoke refresh)
- `GET /api/v1/auth/me` - Текущий пользователь
- `GET /api/v1/admin/users` - Список пользователей (admin)
- `PATCH /api/v1/admin/users/:id` - Смена роли / деактивация (admin)

### Projects (реализовано)
- `GET /api/v1/projects` - Список проектов (с учётом RBAC)
- `GET /api/v1/projects/:id` - Детали проекта
- `POST /api/v1/projects` - Создать проект (admin, analyst)
- `PATCH /api/v1/projects/:id` - Обновить проект
- `DELETE /api/v1/projects/:id` - Удалить проект

### Points of Interest (реализовано)
- `GET /api/v1/projects/:id/pois` - Точки интереса
- `POST /api/v1/projects/:id/pois` - Добавить точку
- `POST /api/v1/projects/:id/pois/:poiId/analyze` - Анализ окружения

### Infrastructure (TODO)
- `GET /api/v1/projects/:id/infrastructure/layers` - Слои
- `POST /api/v1/projects/:id/infrastructure/layers` - Создать слой
- `GET /api/v1/projects/:id/infrastructure/layers/:layerId/objects` - Объекты
- `POST /api/v1/projects/:id/infrastructure/layers/:layerId/objects` - Добавить объект

### Decision Matrices (TODO)
- `GET /api/v1/matrices` - Список матриц
- `GET /api/v1/matrices/:id` - Детали матрицы
- `POST /api/v1/matrices` - Создать матрицу
- `POST /api/v1/matrices/:id/calculate` - Рассчитать
- `DELETE /api/v1/matrices/:id` - Удалить

### Reports (TODO)
- `POST /api/v1/reports/generate` - Генерировать отчёт
- `GET /api/v1/reports/:id/download` - Скачать отчёт

## Разработка

### Backend

```bash
cd backend

# Установка зависимостей
poetry install

# Запуск с авто-перезагрузкой
uvicorn app.main:app --reload

# Линтинг
ruff check .
black .

# Type checking
mypy app/

# Тесты
pytest

# Тесты с покрытием
pytest --cov=app --cov-report=html
```

### Frontend

```bash
cd frontend

# Установка зависимостей
npm install

# Запуск dev сервера
npm run dev

# Сборка для продакшена
npm run build

# Предпросмотр сборки
npm run preview

# Линтинг
npm run lint

# Type checking
npm run type-check
```

### База данных

```bash
cd backend

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

