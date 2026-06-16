# Atlas Grid — decision-matrix

**Актуальный репозиторий (код + CI/CD):** [github.com/Mekcuka/Scaning](https://github.com/Mekcuka/Scaning)  
Локальная папка `decision-matrix/` синхронизирована с веткой `main` этого репозитория (`git remote scaning`).

## Сайт (GitHub Pages)

**https://mekcuka.github.io/Scaning/**

Собирается из `decision-matrix/frontend` при push в `main` репозитория **Scaning**.

## Локальный запуск

См. [decision-matrix/README.md](decision-matrix/README.md) и [decision-matrix/RUN_GUIDE.md](decision-matrix/RUN_GUIDE.md).

Корень репозитория: `C:\Users\user\Documents\Cursore`.

**Первый запуск** — полные команды в [decision-matrix/README.md](decision-matrix/README.md#режим-a--sqlite-рекомендуется-для-первого-запуска).

**Повторный запуск** (SQLite, venv уже создан):

```powershell
cd C:\Users\user\Documents\Cursore\decision-matrix\backend
.\venv\Scripts\Activate.ps1
python C:\Users\user\Documents\Cursore\decision-matrix\backend\run_local.py
```

```powershell
cd C:\Users\user\Documents\Cursore\decision-matrix\frontend
npm run dev
```

- Frontend: http://localhost:5173  
- API / Swagger: http://127.0.0.1:8000/api/v1/docs  

### Docker (PostgreSQL + API)

Полный backend с **PostgreSQL + PostGIS** в контейнерах. Frontend запускается отдельно (как в блоке выше).

**Требования:** Docker Desktop (Windows), контейнеры должны быть запущены.

**Первый запуск** — из корня репозитория:

```powershell
cd C:\Users\user\Documents\Cursore

# env-файлы (если ещё не созданы)
Copy-Item deploy\db.env.example deploy\db.env
Copy-Item decision-matrix\backend\.env.example decision-matrix\backend\.env

# PostgreSQL + API
docker compose -f deploy/docker-compose.dev.yml up --build
```

**Повторный запуск** (без пересборки образа):

```powershell
cd C:\Users\user\Documents\Cursore
docker compose -f deploy/docker-compose.dev.yml up
```

**В фоне:**

```powershell
docker compose -f deploy/docker-compose.dev.yml up -d
```

**Остановить:**

```powershell
docker compose -f deploy/docker-compose.dev.yml stop
docker compose -f deploy/docker-compose.dev.yml down   # удалить контейнеры
```

- API / Swagger: http://127.0.0.1:8000/api/v1/docs  
- PostgreSQL: `localhost:5432` (user `sppr`, db `sppr`, пароль `sppr_secret` — см. `deploy/docker-compose.dev.yml`)

Frontend в другом терминале:

```powershell
cd C:\Users\user\Documents\Cursore\decision-matrix\frontend
npm run dev
```

Отдельные микросервисы для отладки (не нужны для обычной работы — на проде они встроены в API):

| Сервис | Папка | Команда |
|--------|-------|---------|
| Земляные работы куста | `pad-earthwork-planner` | `docker compose up --build` |
| Автосеть | `autoroad-network-planner` | `docker compose up --build` |
| Траектории скважин | `well-trajectory-planner` | `docker compose up --build` |

Подробнее: [CONTRIBUTING.md](CONTRIBUTING.md), продакшен-стек: [DEPLOY.md](DEPLOY.md).

### Cursor MCP (агент в IDE)

Из корня репозитория:

```powershell
.\scripts\get-atlas-grid-token.ps1
```

Затем **Cursor → Settings → Tools & MCP → Reload**. Два сервера: `atlas-grid` (живые данные) и `atlas-grid-dev` (pytest, поиск, git). Подробнее: [docs/features/assistant/assistant-tools.md](docs/features/assistant/assistant-tools.md) §9–11.

### Демо-учётки

| Email | Пароль | Роль |
|-------|--------|------|
| `engineer@oilgas.ru` | `password123` | analyst |
| `admin@oilgas.ru` | `admin1234` | admin |
| `data@oilgas.ru` | `data12345` | data_manager |
| `viewer@oilgas.ru` | `viewer123` | viewer |

Аутентификация: JWT в httpOnly cookies + CSRF. Подробнее: [docs/architecture/auth-rbac.md](docs/architecture/auth-rbac.md).

## Документация

[docs/](docs/) — требования, архитектура, [auth-rbac.md](docs/architecture/auth-rbac.md), **[статус реализации](docs/planning/implementation-status.md)**, [экспорт проекта](docs/features/import-export/project-export.md), [земляные работы куста](docs/features/pad-earthwork/pad-earthwork.md), [траектории скважин](docs/features/well-trajectory/well-trajectory.md) (M1–M3 ✅), [оптимизация размещения кустов](docs/features/pad-placement/pad-placement-optimization.md) (✅), [оценка настроек для траекторий](docs/features/well-trajectory/well-trajectory-app-assessment.md), [план реализации](docs/features/well-trajectory/well-trajectory-implementation-plan.md), [план SOLID](docs/planning/solid-refactoring-plan.md), [границы модулей](docs/architecture/module-boundaries.md), план разработки.

Микросервисы в монорепо: `autoroad-network-planner/` (автосеть), `pad-earthwork-planner/` (объёмы кустовой площадки, порт 8081), `well-trajectory-planner/` (траектории скважин, порт 8082).
