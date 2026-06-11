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

### Демо-учётки

| Email | Пароль | Роль |
|-------|--------|------|
| `engineer@oilgas.ru` | `password123` | analyst |
| `admin@oilgas.ru` | `admin1234` | admin |
| `data@oilgas.ru` | `data12345` | data_manager |
| `viewer@oilgas.ru` | `viewer123` | viewer |

Аутентификация: JWT в httpOnly cookies + CSRF. Подробнее: [docs/architecture/auth-rbac.md](docs/architecture/auth-rbac.md).

## Документация

[docs/](docs/) — требования, архитектура, [auth-rbac.md](docs/architecture/auth-rbac.md), **[статус реализации](docs/planning/implementation-status.md)**, [экспорт проекта](docs/features/project-export.md), [земляные работы куста](docs/features/pad-earthwork.md), [план SOLID](docs/planning/solid-refactoring-plan.md), [границы модулей](docs/architecture/module-boundaries.md), план разработки.

Микросервисы в монорепо: `autoroad-network-planner/` (автосеть), `pad-earthwork-planner/` (объёмы кустовой площадки, порт 8081).
