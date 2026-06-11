# Аутентификация и ролевая модель (FR-1.x)

Реализация в коде: `decision-matrix/backend/app/api/v1/auth.py`, `admin.py`, `services/project_access.py`, `frontend/src/lib/permissions.ts`.

## Обзор

| Компонент | Реализация |
|-----------|------------|
| Протокол | JWT (access + refresh) в **httpOnly cookies** |
| CSRF | Double-submit cookie (`csrf_token` + заголовок `X-CSRF-Token`) |
| Хранение ролей | Колонка `users.role` (enum-строка), одна роль на пользователя |
| Refresh | Rotation + таблица `refresh_tokens` (revoke при logout) |
| Пароли | bcrypt, мин. 8 символов, буква + цифра (FR-1.1.5) |
| Rate limit | Login и register: `AUTH_RATE_LIMIT` (по умолчанию 10/мин на IP, slowapi) |
| Production | `DEMO_USERS_ENABLED=false`, `ALLOW_REGISTRATION=false`, уникальный `SECRET_KEY` |

> **MVP:** нормализованные таблицы `roles` / `user_roles` из [database-schema.md](database-schema.md) **не используются** — запланированы на v2 при multi-role.

## Роли (FR-1.2.1)

| Роль | Значение `users.role` | Права (кратко) |
|------|----------------------|----------------|
| Admin | `admin` | Полный доступ, управление пользователями |
| Analyst | `analyst` | Создание/редактирование своих проектов, POI и отчётов |
| Data Manager | `data_manager` | Чтение всех проектов; запись карты/импорта/инфраструктуры на любой проект |
| Viewer | `viewer` | Только чтение **опубликованных** проектов (`visibility=published`) |

Открытая регистрация (`POST /auth/register`) назначает роль **analyst**. Смена роли — только через admin API.

## Видимость проектов (FR-1.2.6)

- `private` (по умолчанию) — владелец, admin, data_manager (read/write infra по матрице)
- `published` — дополнительно доступен viewer (read-only)

## API

### Auth

```
POST /api/v1/auth/register   — регистрация (role=analyst), Set-Cookie
POST /api/v1/auth/login      — вход, Set-Cookie
POST /api/v1/auth/refresh    — rotation refresh token, Set-Cookie (нужен CSRF)
POST /api/v1/auth/logout     — revoke refresh, clear cookies (нужен CSRF)
GET  /api/v1/auth/me         — текущий пользователь (cookie или Bearer)
```

Login/register **не требуют** CSRF. Остальные mutating запросы — CSRF обязателен, **кроме** запросов с заголовком `Authorization: Bearer <access_token>` (CSRF не проверяется).

Клиент (`frontend/src/lib/api.ts` — barrel; реализация в `lib/api/client.ts`, `apiClient.ts`):

- после login/register — `access_token` / `refresh_token` и `X-CSRF-Token` в `sessionStorage`;
- при старте приложения после успешного `GET /auth/me` — `syncClientAuthSession()` (refresh, если нет Bearer или CSRF в storage);
- перед mutating без токена/CSRF — автоматический `POST /auth/refresh`;
- при **403** с текстом «CSRF» — один повтор после refresh.

### Admin (только `admin`)

```
GET   /api/v1/admin/users              — список пользователей (`created_at`, `last_login_at`; последний вход обновляется при POST /auth/login)
PATCH /api/v1/admin/users/{id}         — role, is_active
GET   /api/v1/admin/stats              — агрегаты (users, projects, pois)
GET   /api/v1/admin/jobs               — журнал фоновых задач (фильтры: status, job_type, project_id)
GET   /api/v1/admin/jobs/health        — Redis, счётчики по статусам, активные задачи
POST  /api/v1/admin/jobs/{id}/cancel   — отмена (идемпотентно: возвращает актуальный статус)
```

## Frontend

| Маршрут | Описание |
|---------|----------|
| `/login` | Вход (RHF + Zod) |
| `/register` | Регистрация |
| `/admin/users` | Пользователи и роли (только admin) |
| `/admin/jobs` | Журнал фоновых задач, health очереди (только admin) |

**UI:** раздел «Администрирование» — вкладки `AdminLayout` (`/admin` → redirect на `/admin/users`). Выход из системы — кнопка-иконка в нижней части сайдбара (`AppLayout`), не в верхней шапке.

- API client: `credentials: 'include'`, авто-refresh при 401; `authEpoch` отменяет устаревший `fetchUser` после login/register
- Регистрация **не** вызывает `logout` перед созданием учётки (только login — при смене пользователя)
- Смена роли/активности в админке отзывает refresh-токены пользователя; UI роли на клиенте — из `/me` (после смены своей роли — авто-`refreshUser`)
- Права UI: `usePermissions()`, фильтр NAV в `AppLayout`
- Viewer: read-only на странице проектов

## Демо-учётки

После `python seed.py` или `run_local.py` (SQLite `backend/data/sppr.db`).  
На **PostgreSQL (прод)** при старте API создаются только **отсутствующие** демо-учётки (`ensure_demo_users`); пароли существующих пользователей не меняются.

| Email | Пароль | Роль |
|-------|--------|------|
| `engineer@oilgas.ru` | `password123` | analyst |
| `admin@oilgas.ru` | `admin1234` | admin |
| `data@oilgas.ru` | `data12345` | data_manager |
| `viewer@oilgas.ru` | `viewer123` | viewer |

Демо-проект «Участок Западный» — `visibility=published`.

## Локальная разработка

1. Backend: `python run_local.py` — **принудительно SQLite** (`data/sppr.db`)
2. Frontend: `npm run dev` — proxy `/api` → `127.0.0.1:8000`
3. **Не задавайте** `VITE_API_URL` на прямой backend в dev — используйте proxy (cookies)
4. `seed.py` по умолчанию пишет в SQLite (как `run_local.py`)

### PostgreSQL (.env)

Если в `backend/.env` указан `DATABASE_URL=postgresql+...`, то `uvicorn` и `seed.py` (без override) работают с Postgres.  
`run_local.py` **всегда** переключается на SQLite — не путайте две БД.

Пересоздать demo-пользователей в SQLite:

```powershell
cd decision-matrix\backend
.\venv\Scripts\python.exe seed.py
```

## Cross-origin (GitHub Pages + API)

Прод: frontend `https://mekcuka.github.io/Scaning/`, API `https://erascaning.duckdns.org/api/v1` (`VITE_API_URL` в GitHub Variables).

| Механизм | Назначение |
|----------|------------|
| httpOnly cookies (`access_token`, `refresh_token`, `csrf_token`) | SameSite=None + Secure на API-домене |
| JSON в теле login/register/refresh | `access_token`, `refresh_token` → `sessionStorage` |
| `Authorization: Bearer` | JSON API и **загрузка custom GLB** (`map3dCustomGlbFetch.ts`) |
| `X-CSRF-Token` + cookie `csrf_token` | mutating без Bearer (fallback); cookie API **нельзя прочитать** с github.io — токен дублируется из заголовка ответа в `sessionStorage` |

Cookies могут **не отправляться** (инкогнито, блокировка third-party cookies). В этом случае работают Bearer + refresh по `sessionStorage`; при полной блокировке — повторный вход.

**Не через `api.ts`:** Three.js `GLTFLoader` для bundled моделей (`/Scaning/map3d-models/…`) — same-origin Pages; для `GET .../map3d-custom-models/{id}/file` — только [`map3dCustomGlbFetch.ts`](../../decision-matrix/frontend/src/lib/map3d/map3dCustomGlbFetch.ts).

## Устранение неполадок

| Симптом | Решение |
|---------|---------|
| «Неверный email или пароль» для admin | Запустите `seed.py` для SQLite; проверьте email/пароль |
| 401 после входа на проде / в инкогнито | Обновите frontend; жёсткое обновление (Ctrl+F5); проверьте `VITE_API_URL` |
| `Request failed` / 401 после входа (localhost) | Очистите cookies; откройте `http://localhost:5173` (proxy), не задавайте `VITE_API_URL` на прямой backend |
| CORS | В `.env` API: `CORS_ORIGINS` должен включать `https://mekcuka.github.io` (без path) |
| CSRF validation failed / «Обновите страницу» при upload GLB | Обновите frontend (sync + retry); перелогин; при Bearer mutating CSRF не нужен |
| Custom GLB 404 на карте после upload | Ctrl+F5; на VM: `ls /opt/decision-matrix/shared/map3d_models/<project_id>/`; mount и миграция `022` — [map3d-models-storage.md](../deploy/map3d-models-storage.md), [map-3d-features.md](../features/map-3d-features.md) §12 |

## Тесты

```powershell
cd decision-matrix\backend
.\venv\Scripts\python.exe -m pytest tests/test_auth_rbac.py -v
```

## Не реализовано (v1.1+)

- Профиль пользователя (FR-1.3.1)
- Audit log (FR-1.3.3)
- SSO / OIDC (v2.0)
- MFA / WebAuthn
- Redis blacklist access token при logout
