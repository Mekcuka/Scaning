# Deploy: GitHub Pages + Yandex Cloud

Репозиторий: https://github.com/Mekcuka/Scaning  
Сайт (Pages): https://mekcuka.github.io/Scaning/  
API (DuckDNS): https://erascaning.duckdns.org

Этот проект использует два независимых автодеплоя:
- frontend: GitHub Pages (уже работает);
- backend: Yandex Cloud VM через Terraform + GitHub Actions.

## 1) Frontend (GitHub Pages)

Workflow: `.github/workflows/deploy-pages.yml`

Проверьте один раз:
- `Settings -> Pages -> Build and deployment -> Source -> GitHub Actions`.
- `Settings -> Secrets and variables -> Actions -> Variables -> VITE_API_URL`
  со значением вида `https://api.your-domain.ru/api/v1`.

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

### GitHub Secrets (обязательно)

- `YC_SA_KEY_JSON` - JSON ключ service account.
- `YC_CLOUD_ID` - ID cloud.
- `YC_FOLDER_ID` - ID folder.
- `YC_REGISTRY_ID` - ID Container Registry (если registry уже существует; иначе можно взять из terraform output после apply).
- `VM_HOST` - публичный IP или DNS VM.
- `VM_USER` - Linux пользователь для SSH (по умолчанию `deploy`).
- `VM_SSH_KEY` - приватный SSH ключ (PEM/OpenSSH) для деплоя.
- `VM_SSH_PUBLIC_KEY` - публичный SSH ключ для Terraform metadata.
- `APP_DOMAIN` - домен backend (например `api.example.ru`).
- `POSTGRES_PASSWORD` - пароль БД (если managed PostgreSQL включен).

### GitHub Variables (опционально, с дефолтами)

- `YC_ZONE` (default `ru-central1-a`)
- `YC_VPC_CIDR` (default `10.20.0.0/24`)
- `YC_VM_NAME` (default `decision-matrix-prod`)
- `YC_VM_CORES` (default `4`)
- `YC_VM_MEMORY_GB` (default `8`)
- `YC_VM_DISK_GB` (default `50`)
- `ENABLE_MANAGED_POSTGRES` (`true`/`false`, default `false`)
- `POSTGRES_DB_NAME` (default `sppr`)
- `POSTGRES_USERNAME` (default `sppr`)

### Runtime env на VM (один раз)

После первого `terraform apply` создайте файл:
- `/opt/decision-matrix/shared/app.env`

Пример можно взять из `deploy/app.env.example`.

Автоматическая загрузка с вашего ПК (PowerShell):

```powershell
cd C:\Users\user\Documents\Cursore
.\deploy\setup-vm-app-env.ps1 `
  -VmHost "<VM_IP_или_DNS>" `
  -PostgresHost "<FQDN_managed_postgres>" `
  -PostgresPassword "<пароль>" `
  -CorsOrigins "https://<login>.github.io,http://localhost:5173"
```

Скрипт: `deploy/setup-vm-app-env.ps1` (SSH-ключ по умолчанию `~/.ssh/yc_deploy_key`).

**Без Managed PostgreSQL (БД в Docker на той же VM):**

```powershell
.\deploy\setup-vm-app-env.ps1 -VmHost "<VM_IP>" -VmUser "<ssh_user>" -KeyPath "<path_to_private_key>" -LocalDb
```

Скрипт создаёт `app.env` и `db.env`; Postgres+PostGIS поднимается сервисом `db` в `deploy/docker-compose.yml`.

Минимум для backend (Managed PostgreSQL в Yandex Cloud):
```env
DATABASE_URL=postgresql+asyncpg://sppr:strong-password@<postgres-host>:6432/sppr
SECRET_KEY=super-long-random-secret
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=https://<your-github-login>.github.io,https://<frontend-domain>
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
- проверяет `https://<APP_DOMAIN>/health`.

## 4) Авто-rollback и ручной rollback

Если smoke-check падает, workflow запускает:
- `/opt/decision-matrix/rollback.sh`

Ручной откат:
```bash
ssh <VM_USER>@<VM_HOST>
/opt/decision-matrix/rollback.sh
```

## 5) Проверка после релиза

- `curl https://<APP_DOMAIN>/health` -> `{"status":"ok"}`
- Swagger: `https://<APP_DOMAIN>/api/v1/docs`
- Frontend использует актуальный `VITE_API_URL`.
