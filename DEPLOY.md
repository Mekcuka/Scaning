# Deploy: GitHub Pages + Yandex Cloud

Репозиторий: https://github.com/Mekcuka/Scaning  
Сайт (Pages): https://mekcuka.github.io/Scaning/  
API (DuckDNS): https://erascaning.duckdns.org

Код приложения: папка `decision-matrix/` в корне репозитория.  
`git push scaning main` — публикует и фронт (Pages), и бэкенд (при изменениях в `decision-matrix/backend/**`).

Этот проект использует два независимых автодеплоя:
- frontend: GitHub Pages (уже работает);
- backend: Yandex Cloud VM через Terraform + GitHub Actions.

## 1) Frontend (GitHub Pages)

Workflow: `.github/workflows/deploy-pages.yml`

Проверьте один раз:
- `Settings -> Pages -> Build and deployment -> Source -> GitHub Actions`.
- Сборка копирует `dist/index.html` → `dist/404.html` (SPA на GitHub Pages); `public/sw.js` отдаёт `index.html` при навигации на вложенные маршруты (`/Scaning/admin/jobs` и т.д.). После обновления SW — жёсткое обновление страницы (Ctrl+Shift+R).
- `Settings -> Secrets and variables -> Actions -> Variables`:
  - `VITE_API_URL` — **`https://erascaning.duckdns.org/api/v1`**
  - `VITE_MAP_3D_ENABLED` — `true` (переключатель 2D/3D на карте)
  - `VITE_MAPTILER_KEY` — ключ [MapTiler](https://cloud.maptiler.com/account/keys) для рельефа в 3D

Тайлы Esri (спутник) и MapTiler (terrain) запрашиваются **из браузера** пользователя; CORS настраивается у провайдеров тайлов, не на backend API.

## 2) Backend (Yandex Cloud, fully automated)

Артефакты:
- Terraform: `infra/terraform/`
- Cloud-init: `infra/cloud-init/user-data.yaml`
- Runtime release: `deploy/docker-compose.yml`, `deploy/Caddyfile`, `deploy/rollback.sh`
- CI/CD: `.github/workflows/deploy-yandex-vm.yml`

### One-time bootstrap

1. Создайте Service Account в Yandex Cloud с правами на:
   - VPC/Compute;
   - Container Registry;
   - Managed PostgreSQL (если нужен).
2. Скачайте authorized key JSON для SA.
3. Подготовьте домен, который указывает на публичный IP VM (A record).
4. В GitHub создайте environment `prod` и включите approval (рекомендуется).

### GitHub Secrets и Variables

**Куда вставлять (backend CI):**  
https://github.com/Mekcuka/Scaning/settings/environments → **prod** → **Environment secrets**  
Job `deploy_backend` в `.github/workflows/deploy-yandex-vm.yml` использует `environment: prod`.  
Пустой secret в `prod` **перекрывает** одноимённый secret репозитория.

**Куда вставлять (frontend):**  
https://github.com/Mekcuka/Scaning/settings/variables/actions → **Repository variables**

#### Secrets — environment `prod` (обязательно для backend deploy)

| Secret | Значение для проекта | Статус / откуда взять |
|--------|----------------------|------------------------|
| `YC_SA_KEY_JSON` | *(не хранить в git)* | JSON authorized key service account YC. Консоль YC → IAM → Service accounts → ключ. Нужны права: Compute, Container Registry (push). |
| `YC_CLOUD_ID` | *(заполнить в GitHub)* | Консоль YC → облако → **ID** (формат `b1g...` или `ao...` — это **cloud**, не folder). |
| `YC_FOLDER_ID` | **`b1gjg9687d9afbsfr2nm`** | ID каталога YC. **Не** подставлять в `YC_REGISTRY_ID`. |
| `YC_REGISTRY_ID` | **`crp12epg012b892ju68g`** | Container Registry (имя: **`prod-decision-matrix-registry`**). **Не** путать с folder `b1gjg9687d9afbsfr2nm`. |
| `VM_HOST` | **`erascaning.duckdns.org`** или **`158.160.228.131`** | A-запись DuckDNS → IP VM (проверено DNS). Для SSH и `ssh-keyscan` в CI. |
| `VM_USER` | **`vovavolgin91`** | Linux-пользователь на VM (проверено SSH). В Terraform по умолчанию `deploy` — для CI нужен **фактический** логин. |
| `VM_SSH_KEY` | *(не хранить в git)* | **Приватный** ключ (не `.pub`): `C:\Users\user\Documents\mykey\ssh-key\ssh-key-1779903372392`. Первая строка должна быть `-----BEGIN RSA PRIVATE KEY-----`, **не** `ssh-rsa AAAA...`. |
| `VM_SSH_KEY_B64` | *(опционально, надёжнее)* | Одна строка base64 всего файла — обходит проблемы с переносами в GitHub UI (см. команду ниже). Если задан — используется вместо `VM_SSH_KEY`. |
| `VM_SSH_PUBLIC_KEY` | *(не хранить в git)* | Публичная часть той же пары (`*.pub`). Должна совпадать с ключом на VM / Terraform `ssh_public_key`. |
| `APP_DOMAIN` | **`erascaning.duckdns.org`** | Домен для Caddy и smoke-check: `https://erascaning.duckdns.org/health` |
| `POSTGRES_PASSWORD` | *(не хранить в git)* | Только если `ENABLE_MANAGED_POSTGRES=true`. Сейчас по умолчанию БД в Docker на VM (`ENABLE_MANAGED_POSTGRES=false`) — можно не задавать. |

**Образ в registry (формирует CI, не secret):**  
`cr.yandex/crp12epg012b892ju68g/decision-matrix-backend:<git-sha>`

**Проверка после заполнения secrets:**

```powershell
curl.exe -s https://erascaning.duckdns.org/health
ssh -i "C:\Users\user\Documents\mykey\ssh-key\ssh-key-1779903372392" -o IdentitiesOnly=yes vovavolgin91@erascaning.duckdns.org "cat /opt/decision-matrix/shared/deploy.env"
```

**Перед повторным deploy в GitHub (`prod`):**

Вариант A — secret **`VM_SSH_KEY_B64`** (рекомендуется, одна строка без переносов):

```powershell
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\Users\user\Documents\mykey\ssh-key\ssh-key-1779903372392"))
$b64 | Set-Clipboard
```

→ GitHub → `prod` → New secret **`VM_SSH_KEY_B64`** → вставить из буфера.

Вариант B — secret **`VM_SSH_KEY`** (многострочный PEM):

```powershell
Get-Content -Raw "C:\Users\user\Documents\mykey\ssh-key\ssh-key-1779903372392" | Set-Clipboard
```

→ вставить в **`VM_SSH_KEY`**. **Не** вставлять `ssh-key-1779903372392.pub` (ошибка: `starts with ssh-rsa`).

Также: `VM_USER` = `vovavolgin91`, `YC_REGISTRY_ID` = `crp12epg012b892ju68g`.

#### Variables — repository (frontend + опционально backend/terraform)

| Variable | Значение для проекта | Где используется |
|----------|----------------------|------------------|
| `VITE_API_URL` | **`https://erascaning.duckdns.org/api/v1`** | `.github/workflows/deploy-pages.yml` |
| `YC_ZONE` | `ru-central1-a` | Terraform / workflow (default) |
| `YC_VPC_CIDR` | `10.20.0.0/24` | Terraform (default) |
| `YC_VM_NAME` | `decision-matrix-prod` | Terraform → VM name `prod-decision-matrix-prod` |
| `YC_VM_CORES` | `4` | Terraform (default) |
| `YC_VM_MEMORY_GB` | `8` | Terraform (default) |
| `YC_VM_DISK_GB` | `50` | Terraform (default) |
| `ENABLE_MANAGED_POSTGRES` | `false` | Postgres в Docker на VM (`deploy/docker-compose.yml`) |
| `POSTGRES_DB_NAME` | `sppr` | Terraform / app |
| `POSTGRES_USERNAME` | `sppr` | Terraform / app |

#### Runtime на VM (не GitHub; файл `/opt/decision-matrix/shared/app.env`)

| Параметр | Значение для проекта |
|----------|----------------------|
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173,https://mekcuka.github.io` (без пути `/Scaning` — origin только схема+хост). Дефолт в `deploy/setup-vm-app-env.ps1`. |
| `DATABASE_URL` | При `-LocalDb`: `postgresql+asyncpg://sppr:<password>@db:5432/sppr` |
| `REDIS_URL` | **`redis://redis:6379/0`** (сервис `redis` в `deploy/docker-compose.yml`; нужен для ARQ-очереди) |
| `ARQ_QUEUE_NAME` | `decision-matrix` (опционально) |
| `JOBS_SYNC_FALLBACK` | `true` только для локальной отладки без Redis; на prod — **`false`** при заданном `REDIS_URL` |
| `ASSISTANT_MCP_ENABLED` | `true` (default) — Streamable HTTP MCP на `/api/v1/mcp`; `false` чтобы отключить |
| Swagger | https://erascaning.duckdns.org/api/v1/docs |
| MCP (Cursor) | https://erascaning.duckdns.org/api/v1/mcp — Bearer JWT после login; **не** на GitHub Pages |

**Фоновые задачи:** контейнер **`worker`** (`arq app.worker.settings.WorkerSettings`) обрабатывает соединение автодорог, async-импорт, логистику песка и `analyze-all`. В проекте одновременно не более одной задачи в статусе `pending`/`running` (ответ **409** при конфликте). API: `POST/GET /projects/{id}/jobs`, `GET .../jobs/active`, `POST .../jobs/{job_id}/cancel`.

**Важно:** API и worker должны использовать **одну** очередь Redis — `ARQ_QUEUE_NAME` (по умолчанию `decision-matrix`). В `services/job_queue.py` при постановке задачи в ARQ явно передаётся это имя (не дефолтный `arq:queue` библиотеки). Если задачи «висят» в `pending`, проверьте `docker compose ps` (сервисы `redis`, `worker` up) и отмените зависшие записи в **Администрирование → Журнал задач**, затем перезапустите расчёт.

**Журнал задач (admin):** при `REDIS_URL` на VM администратор видит очередь в UI (**Администрирование → Журнал задач**, `/admin/jobs`): `GET /admin/jobs`, `GET /admin/jobs/health`, `POST /admin/jobs/{id}/cancel` (идемпотентная отмена с актуальным статусом). Список и счётчики автообновляются каждые 3 с, пока есть `pending`/`running`. См. [docs/product/user-flows.md](docs/product/user-flows.md) §5.3.

### Runtime env на VM (один раз)

После первого `terraform apply` создайте файл:
- `/opt/decision-matrix/shared/app.env`

Пример можно взять из `deploy/app.env.example`.

Автоматическая загрузка с вашего ПК (PowerShell):

```powershell
cd C:\Users\user\Documents\Cursore
.\deploy\setup-vm-app-env.ps1 `
  -VmHost "erascaning.duckdns.org" `
  -VmUser "vovavolgin91" `
  -KeyPath "C:\Users\user\Documents\mykey\ssh-key\ssh-key-1779903372392" `
  -LocalDb `
  -CorsOrigins "http://localhost:5173,http://127.0.0.1:5173,https://mekcuka.github.io"
```

Скрипт: `deploy/setup-vm-app-env.ps1` (SSH-ключ по умолчанию `~/.ssh/yc_deploy_key`).

**Без Managed PostgreSQL (БД в Docker на той же VM):**

```powershell
.\deploy\setup-vm-app-env.ps1 `
  -VmHost "erascaning.duckdns.org" `
  -VmUser "vovavolgin91" `
  -KeyPath "C:\Users\user\Documents\mykey\ssh-key\ssh-key-1779903372392" `
  -LocalDb
```

Скрипт создаёт `app.env` и `db.env`; Postgres+PostGIS поднимается сервисом `db` в `deploy/docker-compose.yml`.

Минимум для backend (Managed PostgreSQL в Yandex Cloud):
```env
DATABASE_URL=postgresql+asyncpg://sppr:strong-password@<postgres-host>:6432/sppr
SECRET_KEY=super-long-random-secret
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=https://mekcuka.github.io,https://mekcuka.github.io/Scaning,https://erascaning.duckdns.org
ALGORITHM=HS256
```

## 3) Как запускать деплой

### Вариант A: инфраструктура + приложение

1. Откройте `Actions -> Deploy backend to Yandex Cloud VM`.
2. Нажмите `Run workflow`.
3. Укажите `terraform_apply=true` (если нужно создать/обновить инфраструктуру).
4. Дождитесь jobs:
   - `terraform_plan`
   - `terraform_apply` (только если включили input)
   - `deploy_backend`

### Вариант B: только выкатка новой версии backend

`push` в `main/master` (изменения в `decision-matrix/backend/**` или `deploy/**`) автоматически:
- собирает Docker image;
- пушит его в Yandex Container Registry;
- копирует release на VM;
- делает rolling update через `docker compose up -d`;
- проверяет `https://erascaning.duckdns.org/health`.

## 4) Авто-rollback и ручной rollback

Если smoke-check падает, workflow запускает:
- `/opt/decision-matrix/rollback.sh`

Ручной откат:
```bash
ssh -i "C:\Users\user\Documents\mykey\ssh-key\ssh-key-1779903372392" vovavolgin91@erascaning.duckdns.org
/opt/decision-matrix/rollback.sh
```

## 5) Проверка после релиза

- `curl https://erascaning.duckdns.org/health` -> `{"status":"ok"}`
- Swagger: `https://erascaning.duckdns.org/api/v1/docs`
- Frontend: https://mekcuka.github.io/Scaning/ — карта `/map`, переключатель **2D | 3D**
- Frontend использует актуальный `VITE_API_URL` (`https://erascaning.duckdns.org/api/v1`).
- **Импорт 3D:** upload GLB → назначение подтипов → 3D на карте / превью; custom GLB грузятся с API с Bearer (см. [docs/architecture/auth-rbac.md](docs/architecture/auth-rbac.md), [docs/features/map-3d-features.md](docs/features/map-3d-features.md)).
- **Логистика песка:** `/flows/logistics` — схема с timeline (полная топология на любом годе, будущие объекты серые); быстрая смена года без remount React Flow (см. [map-objects-and-spatial-calculations.md](docs/features/map-objects-and-spatial-calculations.md) §1.7.1).
- **Админ, журнал задач:** https://mekcuka.github.io/Scaning/admin/jobs — Redis OK, автообновление статусов, отмена `pending`/`running`; нужны backend с `admin/jobs` и актуальный frontend.
- Карта (регрессия линий): pitch **0°** — изгиб 3D = 2D; концы ЛЭП на узлах после pan; см. [map-3d-features.md](docs/features/map-3d-features.md) §6.1
- Карта 2D (производительность): на тяжёлом проекте — плавный pan/hover без лишних React commits; опционально — [testing-strategy.md](docs/testing/testing-strategy.md) § «Карта 2D — ручной perf checklist»

### Custom GLB на VM (хранение)

Файлы: `backend/data/map3d_models/{project_id}/{uuid}.glb` внутри контейнера backend.  
При деплое без постоянного volume каталог **обнуляется** — записи в БД остаются, `GET .../file` отдаёт **404 Model file not found on disk**.

Рекомендация для prod: смонтировать volume в `deploy/docker-compose.yml` на путь `data/map3d_models` (или вынести в object storage — post-MVP).

### Типичные проблемы после релиза frontend

| Симптом | Действие |
|---------|----------|
| «Ошибка CSRF» при upload GLB | Обновить frontend (sync Bearer/CSRF); Ctrl+F5; перелогин |
| Custom GLB **404 (from disk cache)** на карте | Ctrl+F5; проверить наличие файла на VM; убедиться, что задеплоен frontend с `map3dCustomGlbFetch` |
| Bundled Kenney не грузятся | Проверить `VITE_BASE_PATH` / `/Scaning/map3d-models/` в сборке Pages |

### `/health` показывает `"environment":"development"` на prod

CI деплой **не перезаписывает** `/opt/decision-matrix/shared/app.env` — только `deploy.env` (IMAGE_REF, APP_DOMAIN). Если в health видно `development`, на VM вручную:

```powershell
# Проверка
curl.exe -s https://erascaning.duckdns.org/health

# Исправление (SSH на VM): в app.env должно быть ENVIRONMENT=production
# См. deploy/app.env.example и deploy/setup-vm-app-env.ps1
```

После правки: `docker compose -f /opt/decision-matrix/current/docker-compose.yml restart api worker`.

### Autoroad network planner

Локально (monorepo с `autoroad-network-planner/`):

```powershell
pip install -e ../../autoroad-network-planner[steinerpy]
```

Backend: `AUTOROAD_NETWORK_INPROCESS=true`. **На prod VM** рекомендуется `AUTOROAD_NETWORK_SOLVER=steinerpy` (образ API включает SteinerPy). GeoSteiner — только при `GEOSTEINER_BIN_DIR` на VM. Отдельный контейнер `network-planner` не нужен. HTTP-микросервис — локальная отладка (`autoroad-network-planner/docker-compose.yml`).

### Локальная проверка перед `git push`

```powershell
cd decision-matrix/backend
.\venv\Scripts\pip install -e ..\..\autoroad-network-planner[steinerpy]
cd ..\frontend
npm run test
npm run test:coverage   # опционально; см. docs/testing/testing-strategy.md
npm run build
cd ..\backend
.\venv\Scripts\python.exe -m pytest tests/ -q
.\venv\Scripts\python.exe -m pytest tests/ --cov=app --cov-report=term -q
```

Образ backend в CI включает `network-planner` (SteinerPy); GeoSteiner на VM — опционально через `GEOSTEINER_BIN_DIR` в `app.env`.

Покрытие и чеклист тестов: [docs/testing/testing-strategy.md](docs/testing/testing-strategy.md).
