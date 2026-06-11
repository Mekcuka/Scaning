# Хранение custom GLB на production VM

> Связано: [DEPLOY.md](../../DEPLOY.md) § Custom GLB, [map-3d-features.md](../features/map-3d-features.md) § Custom GLB, инициатива **H0.1** в [system-evolution-plan.md](../planning/system-evolution-plan.md).

## Назначение

Пользовательские `.glb` (страница **Импорт 3D**) должны переживать `docker compose up` и redeploy backend. Метаданные — PostgreSQL (`project_map3d_models`), бинарники — persistent volume на VM.

## Пути

| Слой | Путь |
|------|------|
| Хост VM | `/opt/decision-matrix/shared/map3d_models/{project_id}/{model_id}.glb` |
| Контейнер `api` / `worker` | `/app/data/map3d_models/{project_id}/{model_id}.glb` |
| Переменная (опционально) | `MAP3D_MODELS_ROOT` в `app.env` (default внутри образа: `backend/data/map3d_models` → `/app/data/map3d_models`) |

## Compose (prod)

В `deploy/docker-compose.yml` для сервисов `api` и `worker`:

```yaml
volumes:
  - /opt/decision-matrix/shared/map3d_models:/app/data/map3d_models
```

## Первичная настройка VM

Выполнить **один раз** на сервере (SSH):

```bash
sudo mkdir -p /opt/decision-matrix/shared/map3d_models
sudo chmod 755 /opt/decision-matrix/shared/map3d_models
```

После деплоя с обновлённым compose:

```bash
cd /opt/decision-matrix/current
set -a && . /opt/decision-matrix/shared/deploy.env && set +a
docker compose up -d api worker
```

## Проверка после релиза

```bash
# mount
docker inspect decision-matrix-api --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}' | grep map3d

# миграция БД
curl -s https://erascaning.duckdns.org/health | jq .
# ожидается: "alembic_head": "022_map3d_model_metadata"

# каталог (после upload через UI)
ls -la /opt/decision-matrix/shared/map3d_models/
```

## Upload на диске

API пишет атомарно: `{id}.glb.tmp` → rename в `{id}.glb`. При удалении модели или проекта — файл и каталог проекта удаляются (`project_delete`).

## Бэкап

Volume **не** входит в бэкап PostgreSQL. Для DR включите в runbook копирование:

```bash
sudo tar -czf map3d_models-$(date +%F).tar.gz -C /opt/decision-matrix/shared map3d_models
```

Рекомендуется синхронизировать с бэкапом БД (H0.1 в evolution plan).

## Troubleshooting

| Симптом | Действие |
|---------|----------|
| `404 Model file not found on disk` | Файла нет на volume; перезагрузить GLB или восстановить из бэкапа |
| Записи в БД есть, каталог пуст | GLB загружены до включения volume — повторный upload |
| Нет прав на запись | Контейнер работает от root; проверить `chmod 755` на хосте и наличие mount |
| Старый образ без volume | Убедиться, что `current/docker-compose.yml` содержит bind-mount; `docker compose up -d` |

## Вне scope (следующие итерации)

- Yandex Object Storage / MinIO (H2.x)
- Дедупликация по `content_sha256`
- Thumbnail preview GLB
