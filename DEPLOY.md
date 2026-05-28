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
- `Settings -> Secrets and variables -> Actions -> Variables -> VITE_API_URL`:
  **`https://erascaning.duckdns.org/api/v1`**

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
| `CORS_ORIGINS` | `https://mekcuka.github.io,http://localhost:5173` (дефолт в `deploy/setup-vm-app-env.ps1`; для Pages-репо **Scaning**: добавьте `https://mekcuka.github.io/Scaning` при необходимости) |
| `DATABASE_URL` | При `-LocalDb`: `postgresql+asyncpg://sppr:<password>@db:5432/sppr` |
| Swagger | https://erascaning.duckdns.org/api/v1/docs |

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
  -CorsOrigins "https://mekcuka.github.io,https://mekcuka.github.io/Scaning,http://localhost:5173"
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
- Frontend использует актуальный `VITE_API_URL`.
