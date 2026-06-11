# СППР Нефтегаз — MVP

Система поддержки принятия решений для нефтегазовой отрасли.

Документация проекта: [`../docs/`](../docs/) — структура frontend: [`../docs/architecture/frontend-structure.md`](../docs/architecture/frontend-structure.md)

Гайд по локальному запуску: [`RUN_GUIDE.md`](./RUN_GUIDE.md)

## Стек

- **Backend:** FastAPI, SQLAlchemy 2.0, PostgreSQL + PostGIS или SQLite, JWT (httpOnly cookies + RBAC)
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, OpenLayers (2D), MapLibre + Three.js (3D), TanStack Query, Zustand, React Hook Form + Zod

## GitHub Pages

Фронтенд публикуется через GitHub Actions (см. [`../DEPLOY.md`](../DEPLOY.md)).

После push в `main` сайт доступен по адресу `https://<user>.github.io/<repo>/`. Для работы API задайте переменную репозитория `VITE_API_URL` (полный URL, например `https://erascaning.duckdns.org/api/v1`). На cross-origin клиент шлёт `Authorization: Bearer` и синхронизирует CSRF; custom GLB для 3D грузятся через `map3dCustomGlbFetch.ts` — см. [docs/architecture/auth-rbac.md](../docs/architecture/auth-rbac.md), [docs/features/map-3d-features.md](../docs/features/map-3d-features.md).

## Быстрый старт

**Демо-учётки** (после `seed.py`):

| Email | Пароль | Роль |
|-------|--------|------|
| `engineer@oilgas.ru` | `password123` | analyst |
| `admin@oilgas.ru` | `admin1234` | admin |
| `data@oilgas.ru` | `data12345` | data_manager |
| `viewer@oilgas.ru` | `viewer123` | viewer |

> Демо-проект «Участок Западный» опубликован (`visibility=published`) — доступен viewer.

Откройте карту: `/map?project=<uuid>` (UUID проекта из списка в админке или БД).

Аутентификация: JWT в **httpOnly cookies** + CSRF double-submit. Refresh rotation через `POST /auth/refresh`, выход — `POST /auth/logout`.  
Роли и права: [docs/architecture/auth-rbac.md](../docs/architecture/auth-rbac.md).

- Frontend: `http://127.0.0.1:5173`
- Backend API: `http://localhost:8000/api/v1` (или через Vite proxy `/api/v1`)
- Swagger: `http://localhost:8000/api/v1/docs`

### Режим A — SQLite (рекомендуется для первого запуска)

Команды для **Windows PowerShell**. Корень репозитория: `C:\Users\user\Documents\Cursore`.

**Backend** (первый запуск — venv и зависимости):

```powershell
cd C:\Users\user\Documents\Cursore\decision-matrix\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r C:\Users\user\Documents\Cursore\decision-matrix\backend\requirements.txt
python -m pip install -e C:\Users\user\Documents\Cursore\autoroad-network-planner[steinerpy]
python -m pip install -e C:\Users\user\Documents\Cursore\pad-earthwork-planner
python C:\Users\user\Documents\Cursore\decision-matrix\backend\run_local.py
```

> `run_local.py` при отсутствии `pad-earthwork-planner` попытается установить его автоматически. Земляные работы куста: [docs/features/pad-earthwork.md](../docs/features/pad-earthwork.md).

Проверить, что активен именно `venv`:

```powershell
python -c "import sys; print(sys.executable)"
python -m pip -V
```

**Backend** (повторный запуск — venv уже создан):

```powershell
cd C:\Users\user\Documents\Cursore\decision-matrix\backend
.\venv\Scripts\Activate.ps1
python C:\Users\user\Documents\Cursore\decision-matrix\backend\run_local.py
```

**Frontend** (в другом терминале; `npm install` — только при первом запуске или после изменения `package.json`):

```powershell
cd C:\Users\user\Documents\Cursore\decision-matrix\frontend
npm install
npm run dev
```

**Frontend** (повторный запуск):

```powershell
cd C:\Users\user\Documents\Cursore\decision-matrix\frontend
npm run dev
```

Скрипт `run_local.py` создаёт БД в `backend/data/sppr.db`, при необходимости ставит `pad-earthwork-planner`, выполняет seed и запускает API.

> **Важно:** `run_local.py` всегда использует SQLite. Файл `backend/.env` с PostgreSQL применяется только при запуске через `uvicorn` напрямую. `seed.py` по умолчанию пишет в SQLite (как `run_local.py`).

### Режим B — PostgreSQL + PostGIS (полная карта FR-2)

1. Установите PostgreSQL с расширением [PostGIS](https://postgis.net/install/) локально.
2. Создайте БД и пользователя (или используйте существующие).
3. Скопируйте `backend/.env.example` → `backend/.env` и задайте `DATABASE_URL`:

   ```env
   DATABASE_URL=postgresql+asyncpg://sppr:sppr_secret@localhost:5432/sppr
   ```

4. Backend (первый запуск — venv, зависимости, seed; затем API):

   ```powershell
   cd C:\Users\user\Documents\Cursore\decision-matrix\backend
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   python -m pip install -r C:\Users\user\Documents\Cursore\decision-matrix\backend\requirements.txt
   python -m pip install -e C:\Users\user\Documents\Cursore\autoroad-network-planner[steinerpy]
   python -m pip install -e C:\Users\user\Documents\Cursore\pad-earthwork-planner
   python C:\Users\user\Documents\Cursore\decision-matrix\backend\seed.py
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

   Повторный запуск (venv уже есть):

   ```powershell
   cd C:\Users\user\Documents\Cursore\decision-matrix\backend
   .\venv\Scripts\Activate.ps1
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

5. Frontend — как в режиме A (см. блоки выше).

> **Карта:** полный FR-2.4 (PostGIS-геометрия, пространственные запросы) — только в режиме B. В SQLite используется haversine fallback; часть PostGIS-функций недоступна.

## Структура

```
decision-matrix/
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI entry
│   │   ├── api/v1/
│   │   │   ├── router.py              # Projects, POI, rates, economic-params
│   │   │   ├── auth.py, admin.py
│   │   │   ├── map.py                 # Карта, импорт, инфраструктура
│   │   │   ├── one_pagers.py, flow.py, graph.py
│   │   │   ├── import_connections.py, sand_logistics.py
│   │   ├── api/rbac.py                # require_roles
│   │   ├── services/project_access.py # RBAC по проектам
│   │   ├── models/                    # SQLAlchemy models
│   │   └── schemas/                   # Pydantic schemas
│   ├── run_local.py                   # SQLite: init + seed + uvicorn
│   └── seed.py                        # Демо-пользователи и проект
└── frontend/
    └── src/
        ├── pages/                     # Login, Register, Admin, Dashboard, Export...
        ├── lib/projectExport/         # GeoJSON + Excel/CSV export
        ├── lib/permissions.ts         # Матрица прав UI
        └── hooks/usePermissions.ts
```

## Реализованные модули

> Детали и пробелы относительно FR: [docs/planning/implementation-status.md](../docs/planning/implementation-status.md).

| Модуль | Статус |
|--------|--------|
| Auth (JWT cookies, CSRF, refresh, logout) | ✅ |
| RBAC (4 роли, project access, admin API + stats) | ✅ |
| Auth UI (login, register, admin page) | ✅ |
| Проекты, POI, пороги, visibility `published` | ✅ |
| Параметры: ставки (16), пропускная способность, песок, даты ввода | ✅ |
| Инфраструктура + PostGIS / haversine (слои, точки, линии) | ✅ |
| Анализ окружения POI (persist + candidates + override) | ✅ |
| Карта 2D OpenLayers (рисование, поиск, радиусы, линии POI→external) | ✅ |
| Карта 3D MapLibre (`VITE_MAP_3D_ENABLED`) | ✅ |
| Матрица (таблица + карточки, eng-бейджи, фильтр превышений) | ✅ |
| Импорт: CSV, GeoJSON, KML, Shapefile, Spark, API connections, async | ✅ |
| **Экспорт** (`/export`): координаты точечных/всех объектов, GeoJSON проекта (Excel, CSV, `.geojson`) | ✅ |
| Потоки PFD (`/flows`) | ✅ |
| Граф сети (build/list nodes/edges) | ✅ |
| Одностраничник (CRUD, PDF print, PPTX export) | ✅ |
| Песок / логистика (analyze API + UI) | ✅ |
| Земляные работы куста (`oil_pad`/`gas_pad`, flat MVP) | ✅ |

## API

### Auth и Admin

```
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
GET  /api/v1/admin/users
PATCH /api/v1/admin/users/:id
GET  /api/v1/admin/stats
```

### Projects и данные

```
GET  /api/v1/projects
POST /api/v1/projects
GET  /api/v1/projects/:id
PATCH /api/v1/projects/:id
DELETE /api/v1/projects/:id
GET/PUT  /api/v1/projects/:id/rates
GET/PUT  /api/v1/projects/:id/distance-defaults
GET/PUT  /api/v1/projects/:id/economic-params
GET/POST /api/v1/projects/:id/pois
PATCH/DELETE .../pois/:poiId
POST     .../pois/:poiId/analyze
POST     .../pois/analyze-all
GET      .../pois/:poiId/analysis
GET      .../pois/:poiId/candidates?subtype=
PATCH    .../pois/:poiId/analysis/:subtype
GET/POST/PATCH/DELETE .../infrastructure/layers
GET/POST/PATCH/DELETE .../infrastructure/objects
POST     .../import/preview | csv | geojson | kml | shapefile | spark (+ /async где есть)
GET      /api/v1/import/logs
GET/POST/PATCH/DELETE .../import_connections
POST     .../import/sync/:connectionId
GET/PUT/DELETE .../flow-schematic
GET/POST .../infrastructure/networks/build
GET      .../infrastructure/networks/:id/nodes|edges
POST     .../sand-logistics/analyze
POST     .../infrastructure/objects/:id/pad-earthwork/compute
GET      .../infrastructure/objects/:id/pad-earthwork/last
PATCH    .../infrastructure/objects/:id/pad-earthwork/params
GET/POST/PUT/DELETE .../one-pagers
POST     .../one-pagers/:opId/export/pptx
```

PDF генерируется на клиенте (`window.print()` + print CSS). PPTX — backend (`python-pptx`), снимок карты передаётся как `map_snapshot_base64`.

Полное описание auth/RBAC: [docs/architecture/auth-rbac.md](../docs/architecture/auth-rbac.md).
