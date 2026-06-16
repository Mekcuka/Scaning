# Хранение DEM кустовых площадок на production VM

> Связано: [DEPLOY.md](../../DEPLOY.md), [pad-earthwork.md](../features/pad-earthwork/pad-earthwork.md) § DEM.

## Назначение

GeoTIFF рельефа для расчёта выемки (`oil_pad` / `gas_pad`) кэшируется на диске и переживает redeploy backend. **Метаданные** (bbox, hash, размер, источник) — PostgreSQL (`infra_object_pad_dem`, одна строка на объект).

## Пути

| Слой | Путь |
|------|------|
| Хост VM | `/opt/decision-matrix/shared/pad_dem/{project_id}/{asset_id}.tif` |
| Контейнер `api` / `worker` | `/app/data/pad_dem/{project_id}/{asset_id}.tif` |
| Переменная (опционально) | `PAD_DEM_DATA_ROOT` в `app.env` (default: `backend/data/pad_dem` → `/app/data/pad_dem`) |

При смене области расчёта (контур, padding) файл **перезаписывается** (тот же `asset_id`); устаревший legacy-файл из properties удаляется.

## Compose (prod)

В `deploy/docker-compose.yml` для сервисов `api` и `worker`:

```yaml
volumes:
  - /opt/decision-matrix/shared/pad_dem:/app/data/pad_dem
```

## Первичная настройка VM

```bash
sudo mkdir -p /opt/decision-matrix/shared/pad_dem
sudo chmod 755 /opt/decision-matrix/shared/pad_dem
```

После деплоя:

```bash
cd /opt/decision-matrix/current
set -a && . /opt/decision-matrix/shared/deploy.env && set +a
docker compose up -d api worker
```

## Проверка

```bash
docker inspect decision-matrix-api --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}' | grep pad_dem
ls -la /opt/decision-matrix/shared/pad_dem/
curl -s https://erascaning.duckdns.org/health | jq .alembic_head
# ожидается revision с 024_infra_object_pad_dem
```

## База данных

Таблица `infra_object_pad_dem`:

- `infrastructure_object_id` — UNIQUE, CASCADE при удалении объекта
- `bbox_hash` — для cache hit без повторной загрузки OpenTopography
- `file_size_bytes`, `fetched_at`, `source`

Свойства объекта (`pad_dem_asset_id`, …) синхронизируются для UI/API совместимости.

## Типичные проблемы

| Симптом | Действие |
|---------|----------|
| DEM пропал после redeploy | Проверить bind-mount `pad_dem` на api **и** worker |
| `dem_not_loaded` / 404 | Перезагрузить DEM в карточке куста («Загрузить DEM») |
| Worker не видит файл после fetch на api | Оба контейнера должны монтировать один каталог |
