# Гайд по запуску проекта

Этот документ описывает локальный запуск `decision-matrix` (backend + frontend).

## 1) Что нужно установить

- **Python** 3.11+ (рекомендуется 3.11/3.12)
- **Node.js** 20+ и **npm**
- (Опционально) **PostgreSQL + PostGIS**, если нужен полный гео-режим

Проверка версий:

```powershell
python --version
node --version
npm --version
```

## 2) Быстрый запуск (рекомендуется, SQLite)

### Шаг 1. Запуск backend

Команды с полными путями:

```powershell
# 1)
cd C:\Users\user\Documents\Cursore\decision-matrix\backend
# 2)
python -m venv C:\Users\user\Documents\Cursore\decision-matrix\backend\venv
# 3)
.\\venv\\Scripts\\Activate.ps1
# 4)
python -m pip install -r C:\Users\user\Documents\Cursore\decision-matrix\backend\requirements.txt
# 5)
python C:\Users\user\Documents\Cursore\decision-matrix\backend\run_local.py
```

Проверка, что активен именно `venv`:

```powershell
python -c "import sys; print(sys.executable)"
python -m pip -V
```

Что делает `run_local.py`:
- создаёт/инициализирует SQLite БД `backend/data/sppr.db`
- выполняет сидирование демо-данными
- запускает API на `http://127.0.0.1:8000`

### Шаг 2. Запуск frontend (в новом терминале)

```powershell
# 1)
cd C:\Users\user\Documents\Cursore\decision-matrix\frontend
# 2)
npm install
# 3)
npm run dev
```

Frontend будет доступен на `http://127.0.0.1:5173`.

## 3) Повторный запуск (со второго раза)

Если проект уже запускался ранее, обычно **не нужно** повторно:
- создавать venv (`python -m venv ...`)
- устанавливать backend-зависимости (`pip install -r ...`)
- устанавливать frontend-зависимости (`npm install`)

### Быстрые команды для повторного запуска (SQLite)

Backend:

```powershell
# 1)
cd C:\Users\user\Documents\Cursore\decision-matrix\backend
# 2)
.\\venv\\Scripts\\Activate.ps1
# 3)
python C:\Users\user\Documents\Cursore\decision-matrix\backend\run_local.py
```

Frontend (в отдельном терминале):

```powershell
# 1)
cd C:\Users\user\Documents\Cursore\decision-matrix\frontend
# 2)
npm run dev
```

Когда снова запускать установку зависимостей:
- после `git pull`, если изменились `requirements.txt` или `package.json`
- после удаления `venv` или `node_modules`
- при ошибках `ModuleNotFoundError` / `Cannot find module`

## 4) Доступы и полезные URL

### Демо-учётки (SQLite, после seed)

| Email | Пароль | Роль |
|-------|--------|------|
| `engineer@oilgas.ru` | `password123` | analyst |
| `admin@oilgas.ru` | `admin1234` | admin |
| `data@oilgas.ru` | `data12345` | data_manager |
| `viewer@oilgas.ru` | `viewer123` | viewer |

- Frontend: `http://127.0.0.1:5173` (или `:5174`, если 5173 занят)
- Backend API: `http://127.0.0.1:8000/api/v1`
- Swagger: `http://127.0.0.1:8000/api/v1/docs`
- Страницы: `/login`, `/register`, `/admin` (только admin)

Аутентификация через **httpOnly cookies** (не localStorage). Подробнее: [docs/auth-rbac.md](../docs/auth-rbac.md).

### Пересоздание demo-пользователей

```powershell
cd C:\Users\user\Documents\Cursore\decision-matrix\backend
.\venv\Scripts\python.exe seed.py
```

`seed.py` дополняет отсутствующих пользователей в SQLite (`data/sppr.db`).

## 5) Полный режим карты (PostgreSQL + PostGIS)

Используйте этот режим, если нужны пространственные функции PostGIS.

1. Установите PostgreSQL с расширением PostGIS.
2. Создайте БД и пользователя.
3. В `C:\Users\user\Documents\Cursore\decision-matrix\backend` создайте `.env` на основе `.env.example`.
4. Укажите `DATABASE_URL`, например:

```env
DATABASE_URL=postgresql+asyncpg://sppr:sppr_secret@localhost:5432/sppr
SECRET_KEY=change-me-in-production
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173
```

> Для Postgres `seed.py` использует `DATABASE_URL` из `.env`. Для SQLite-dev используйте `run_local.py` + `seed.py` (override на SQLite внутри скрипта).

5. Запустите backend:

```powershell
# 1)
cd C:\Users\user\Documents\Cursore\decision-matrix\backend
# 2)
.\\venv\\Scripts\\Activate.ps1
# 3)
python -m pip install -r C:\Users\user\Documents\Cursore\decision-matrix\backend\requirements.txt
# 4)
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
# 5)
python C:\Users\user\Documents\Cursore\decision-matrix\backend\seed.py
```

6. Frontend запускается как обычно:

```powershell
# 1)
cd C:\Users\user\Documents\Cursore\decision-matrix\frontend
# 2)
npm run dev
```

## 6) Если вы не на Windows

Для активации venv:

- macOS/Linux: `source venv/bin/activate`
- Windows PowerShell: `.\venv\Scripts\Activate.ps1`

Остальные команды одинаковые.

## 7) Карта (поведение UI)

- **Расчётный граф** (узлы/рёбра `infrastructure_*`) **не рисуется на карте** — только объекты инфраструктуры, POI, линии анализа. Топология хранится в БД и используется в расчётах («Потоки», логистика песка). Подробнее: [map-objects-and-spatial-calculations.md](../docs/map-objects-and-spatial-calculations.md) §5–§6.
- **Горячие клавиши** (на странице карты, не в полях ввода): **E** — вкл/выкл «Редактирование на карте»; **Del** / **Backspace** — удалить выбранное; **Ctrl+Z** — отмена; **Enter** — завершить черновик линии; **Escape** — закрыть модал/поиск или выйти из рисования; в режиме **«Линия»** — **двойной ЛКМ** или **двойной ПКМ** завершить линию (в пустом месте создаётся узел `node`); в режиме **«Выбор»** + редактирование — **двойной ЛКМ** по **промежуточной** вершине удаляет её.
- **Рисование линии:** начало — на точечном объекте (≤300 м); середина — свободно; конец — на объекте или авто-`node`. Координаты в БД — полные; в строке внизу карты — 3 знака.
- **Редактирование линий:** «Редактирование на карте» → «Выбор» → линия. Концы нельзя оставить без привязки к точечному объекту. Подсказки — в footer карты.
- **Поиск на карте:** по названию, подтипу, имени слоя и строковым свойствам объектов.
- **Удаление линий:** после удаления линейного объекта backend пересобирает топологию сети из оставшихся линий; при групповом удалении frontend вызывает `buildNetwork` один раз.
- **Два порта frontend** (`5173` и `5174`): это **разные** dev-серверы и разные origin в браузере (`localStorage` / `sessionStorage` не общие). Держите **один** `npm run dev`; если 5173 занят — остановите старый процесс. На странице карты в dev показывается предупреждение, если frontend открыт не на порту **5173**.
- **2.5D / 3D карта:** в `frontend/.env`: `VITE_MAP_3D_ENABLED=true` и `VITE_MAPTILER_KEY=<ключ MapTiler>`. Перезапустите `npm run dev`. На `/map` — **2D | 3D**; в слоях — спутник, **Рельеф (3D)**, **3D-модели** (glTF), фильтры подтипов. Рисование только в 2D. Точки: glTF + палитра слоя; линии: 3D-трубы **по прямым сегментам между вершинами** (как 2D), ЛЭП — пролёты проводов в плане как 2D. Документация: [docs/map-3d-features.md](../docs/map-3d-features.md), правила объектов: [map-objects-and-spatial-calculations.md](../docs/map-objects-and-spatial-calculations.md) §1.5.
- **Локальный dev и `VITE_BASE_PATH`:** для `npm run dev` задайте `VITE_BASE_PATH=/` (или не задавайте переменную), иначе Vite может собрать base `/Scaning/` и страница login не откроется на `http://localhost:5173/`.
- **Проверка перед релизом:** `cd decision-matrix/frontend && npm run test && npm run build`; `cd decision-matrix/backend && pytest tests/ -q` (кроме `test_demo_users` — нужна SQLite `data/sppr.db` с таблицами).
- **Покрытие (опционально):** `npm run test:coverage` (frontend), `pytest tests/ --cov=app --cov-report=term-missing` (backend). См. [docs/testing-strategy.md](../docs/testing-strategy.md).
- **Демо-сеть для проверки 3D:** из `backend` с активированным venv: `python scripts/draw_demo_map_network.py --project-name "третий проект"` (или имя вашего проекта).

## 8) Частые проблемы

- **Не входит admin / Invalid credentials**  
  Demo-пользователи могли не попасть в SQLite. Запустите `python seed.py` в `backend/`. Убедитесь, что backend запущен через `run_local.py` (SQLite), а не только через `.env` Postgres.

- **Request failed / 401 после входа**  
  Очистите cookies для `localhost`. Используйте frontend через Vite proxy (`http://localhost:5173`), не задавайте `VITE_API_URL` на прямой backend в dev.

- Порт `5173` или `8000` занят  
  Освободите порт или запустите сервис на другом порту. Добавьте новый порт frontend в `CORS_ORIGINS`. Не открывайте одновременно `localhost:5173` и `localhost:5174` — см. §7 «Карта».

- **«Построить сеть» / Not Found** при вызове API  
  Часто на порту `8000` висит **старый** uvicorn без маршрутов `autoroad-network`. Закройте лишние терминалы с backend или выполните `Get-Process python* | Stop-Process -Force`, затем **один** раз `python run_local.py` (скрипт освобождает порт 8000 на Windows). Проверка: в Swagger (`http://127.0.0.1:8000/api/v1/docs`) должны быть `POST .../autoroad-network/plan` и `.../apply`. UI открывайте на **5173** (`npm run dev`), не на `:8000`.

- `pip install` падает на зависимостях  
  Обновите pip: `python -m pip install --upgrade pip`.

- Frontend не видит API  
  Убедитесь, что backend запущен и доступен по `http://127.0.0.1:8000`.

- Ошибка CORS  
  Проверьте `CORS_ORIGINS` в `backend/.env` — должен совпадать с URL frontend (включая порт).

- CSRF validation failed / «Обновите страницу» (в т.ч. upload GLB на проде)  
  Перелогиньтесь или обновите frontend: клиент синхронизирует Bearer/CSRF через `POST /auth/refresh`; при `Authorization: Bearer` CSRF не проверяется. См. [docs/auth-rbac.md](../docs/auth-rbac.md).

- Custom GLB не отображаются в 3D после загрузки (прод, 404 в Network)  
  На GitHub Pages файлы моделей запрашиваются с API с Bearer (`map3dCustomGlbFetch.ts`), не через cookie-only GLTFLoader. Ctrl+F5 (сброс кэша 404). См. [docs/map-3d-features.md](../docs/map-3d-features.md) § custom GLB.
