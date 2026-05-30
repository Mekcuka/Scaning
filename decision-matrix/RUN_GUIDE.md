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

## 7) Частые проблемы

- **Не входит admin / Invalid credentials**  
  Demo-пользователи могли не попасть в SQLite. Запустите `python seed.py` в `backend/`. Убедитесь, что backend запущен через `run_local.py` (SQLite), а не только через `.env` Postgres.

- **Request failed / 401 после входа**  
  Очистите cookies для `localhost`. Используйте frontend через Vite proxy (`http://localhost:5173`), не задавайте `VITE_API_URL` на прямой backend в dev.

- Порт `5173` или `8000` занят  
  Освободите порт или запустите сервис на другом порту. Добавьте новый порт frontend в `CORS_ORIGINS`.

- `pip install` падает на зависимостях  
  Обновите pip: `python -m pip install --upgrade pip`.

- Frontend не видит API  
  Убедитесь, что backend запущен и доступен по `http://127.0.0.1:8000`.

- Ошибка CORS  
  Проверьте `CORS_ORIGINS` в `backend/.env` — должен совпадать с URL frontend (включая порт).

- CSRF validation failed  
  Перелогиньтесь. Mutating запросы должны идти с cookie `csrf_token` и заголовком `X-CSRF-Token`.
