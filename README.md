# СППР Нефтегаз — decision-matrix

**Актуальный репозиторий (код + CI/CD):** [github.com/Mekcuka/Scaning](https://github.com/Mekcuka/Scaning)  
Локальная папка `decision-matrix/` синхронизирована с веткой `main` этого репозитория (`git remote scaning`).

## Сайт (GitHub Pages)

**https://mekcuka.github.io/Scaning/**

Собирается из `decision-matrix/frontend` при push в `main` репозитория **Scaning**.

> Старый адрес `mekcuka.github.io/Cursor_Scan/` и репозиторий `Cursor_Scan` **не обновляются** — смотрите **Scaning**.

## Локальный запуск

См. [decision-matrix/README.md](decision-matrix/README.md) и [decision-matrix/RUN_GUIDE.md](decision-matrix/RUN_GUIDE.md).

```powershell
# Backend (SQLite)
cd decision-matrix\backend
.\venv\Scripts\python.exe run_local.py

# Frontend (другой терминал)
cd decision-matrix\frontend
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

Аутентификация: JWT в httpOnly cookies + CSRF. Подробнее: [docs/auth-rbac.md](docs/auth-rbac.md).

## HTML-прототип (без backend)

Исходники: [Cursor_Scan/index.html](Cursor_Scan/index.html) — открыть локально или через `npx serve Cursor_Scan`.

## Документация

[docs/](docs/) — требования, архитектура, [auth-rbac.md](docs/auth-rbac.md), план разработки.
