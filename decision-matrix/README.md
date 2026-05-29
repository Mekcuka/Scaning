# СППР Нефтегаз — MVP

Система поддержки принятия решений для нефтегазовой отрасли.

Документация проекта: [`../docs/`](../docs/)

Гайд по локальному запуску: [`RUN_GUIDE.md`](./RUN_GUIDE.md)

HTML-прототип (mock): [`../Cursor_Scan/`](../Cursor_Scan/)

## Стек

- **Backend:** FastAPI, SQLAlchemy 2.0, PostgreSQL + PostGIS или SQLite, JWT
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, OpenLayers, TanStack Query, Zustand

## GitHub Pages

Фронтенд публикуется через GitHub Actions (см. [`../DEPLOY.md`](../DEPLOY.md)).

После push в `main` сайт доступен по адресу `https://<user>.github.io/<repo>/`. Для работы API задайте переменную репозитория `VITE_API_URL` (URL развёрнутого backend).

## Быстрый старт

**Демо-вход:** `engineer@oilgas.ru` / `password123`

- Frontend: `http://127.0.0.1:5173`
- Backend API: `http://localhost:8000/api/v1` (или через Vite proxy `/api/v1`)
- Swagger: `http://localhost:8000/api/v1/docs`

### Режим A — SQLite (рекомендуется для первого запуска)

```powershell
# 1)
cd C:\Users\user\Documents\Cursore\decision-matrix\backend
# 2)
python -m venv C:\Users\user\Documents\Cursore\decision-matrix\backend\venv
# 3)
.\venv\Scripts\Activate.ps1
# 4)
python -m pip install -r C:\Users\user\Documents\Cursore\decision-matrix\backend\requirements.txt
# 5)
python C:\Users\user\Documents\Cursore\decision-matrix\backend\run_local.py
```

Проверить, что активен именно `venv`:

```powershell
python -c "import sys; print(sys.executable)"
python -m pip -V
```

В другом терминале:

```powershell
# 1)
cd C:\Users\user\Documents\Cursore\decision-matrix\frontend
# 2)
npm install
# 3)
npm run dev
```

Скрипт `run_local.py` создаёт БД в `backend/data/sppr.db`, выполняет seed и запускает API.

### Режим B — PostgreSQL + PostGIS (полная карта FR-2)

1. Установите PostgreSQL с расширением [PostGIS](https://postgis.net/install/) локально.
2. Создайте БД и пользователя (или используйте существующие).
3. Скопируйте `backend/.env.example` → `backend/.env` и задайте `DATABASE_URL`:

   ```env
   DATABASE_URL=postgresql+asyncpg://sppr:sppr_secret@localhost:5432/sppr
   ```

4. Backend:

   ```powershell
   # 1)
   cd C:\Users\user\Documents\Cursore\decision-matrix\backend
   # 2)
   .\venv\Scripts\Activate.ps1
   # 3)
   python -m pip install -r C:\Users\user\Documents\Cursore\decision-matrix\backend\requirements.txt
   # 4)
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   # 5)
   python C:\Users\user\Documents\Cursore\decision-matrix\backend\seed.py
   ```

5. Frontend — как в режиме A (`npm run dev`).

> **Карта:** полный FR-2.4 (PostGIS-геометрия, пространственные запросы) — только в режиме B. В SQLite используется haversine fallback; часть PostGIS-функций недоступна.

## Структура

```
decision-matrix/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry
│   │   ├── api/v1/router.py     # REST endpoints
│   │   ├── models/              # SQLAlchemy models
│   │   ├── schemas/             # Pydantic schemas
│   │   └── services/            # Расчёты (TOPSIS, WSM, стоимость)
│   ├── run_local.py             # SQLite: init + seed + uvicorn
│   └── seed.py                  # Демо-данные
└── frontend/
    └── src/
        ├── pages/               # Dashboard, Карта, Проекты, Матрица...
        ├── components/          # Layout, MapView (OpenLayers)
        └── lib/                 # API client, specs
```

## Реализованные модули (MVP)

| Модуль | Статус |
|--------|--------|
| Auth (JWT) | ✅ |
| Проекты, POI | ✅ |
| Ставки (16 показателей) | ✅ |
| Инфраструктура + PostGIS (geometry, слои) | ✅ |
| Анализ окружения POI (persist + candidates) | ✅ |
| TOPSIS / WSM ранжирование | ✅ |
| Карта OpenLayers (рисование, радиусы, линии POI→external) | ✅ |
| Матрица (таблица + карточки) | ✅ UI |
| Импорт CSV / GeoJSON / Spark export | ✅ |
| Одностраничник / PDF | ✅ UI |

## API

```
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/auth/me
GET  /api/v1/projects
POST /api/v1/projects
GET  /api/v1/projects/:id/rates
PUT  /api/v1/projects/:id/rates
GET  /api/v1/projects/:id/pois
POST /api/v1/projects/:id/pois
POST /api/v1/projects/:id/pois/:poiId/analyze
GET  /api/v1/projects/:id/infrastructure/objects
PATCH/DELETE .../infrastructure/objects/:id
GET/POST/PATCH/DELETE .../infrastructure/layers
GET  /api/v1/projects/:id/pois/:poiId/analysis
GET  /api/v1/projects/:id/pois/:poiId/candidates?subtype=
POST /api/v1/projects/:id/import/csv
POST /api/v1/projects/:id/import/geojson
POST /api/v1/projects/:id/import/spark
GET  /api/v1/import/logs?project_id=
POST /api/v1/ranking/calculate
```
