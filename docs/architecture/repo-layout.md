# Карта монорепозитория

> Связано: [module-boundaries.md](module-boundaries.md), [frontend-structure.md](frontend-structure.md), [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Корень репозитория

| Путь | Назначение |
|------|------------|
| [`decision-matrix/`](../../decision-matrix/) | Основное приложение Atlas Grid (backend + frontend) |
| [`autoroad-network-planner/`](../../autoroad-network-planner/) | Микросервис автосети (источник для in-process vendor) |
| [`pad-earthwork-planner/`](../../pad-earthwork-planner/) | Микросервис земляных работ куста |
| [`well-trajectory-planner/`](../../well-trajectory-planner/) | Микросервис траекторий скважин |
| [`deploy/`](../../deploy/) | Docker Compose, Caddy, env-примеры |
| [`infra/`](../../infra/) | Terraform, cloud-init |
| [`docs/`](../../docs/) | Продукт, архитектура, фичи, wiki |
| [`scripts/`](../../scripts/) | Repo-скрипты (MCP token, vendor staging, sync) |

Локальная папка может называться `Cursore`; GitHub-репозиторий — [Mekcuka/Scaning](https://github.com/Mekcuka/Scaning).

## `decision-matrix/backend`

```
backend/
├── app/                 # FastAPI приложение (исходники, без runtime binary)
├── data/                # Локальные runtime-данные (gitignored бинарники)
│   ├── map3d_models/    # GLB пользовательских 3D-моделей
│   ├── pad_dem/         # GeoTIFF DEM кустовых площадок
│   ├── exports/         # One-pager PPTX (gitignored)
│   └── *.db             # SQLite (gitignored)
├── tests/
├── alembic/
└── Dockerfile           # Ожидает *-vendor/ в build context (staging)
```

**Правило:** бинарные runtime-файлы — только в `backend/data/`, **не** под `app/`. Пути резолвятся через [`app/core/paths.py`](../../decision-matrix/backend/app/core/paths.py) (`data_dir`) или env (`PAD_DEM_DATA_ROOT`, `MAP3D_MODELS_ROOT`).

### Backend services (выборочно)

| Пакет | Назначение |
|-------|------------|
| `app/services/map3d/` | Storage, GLB optimize, BFF handlers для custom 3D models |
| `app/services/pad_earthwork/` | DEM, earthwork API |
| `app/services/autoroad_network/` | BFF автосети |

Старые пути (`map3d_custom_models.py`, …) — thin re-export stubs для обратной совместимости.

## Vendor и shared

| Артефакт | Источник | Когда копируется |
|----------|----------|------------------|
| `network-planner-vendor/` | `autoroad-network-planner/` | Docker build (локально: [`scripts/stage-backend-vendors.ps1`](../../scripts/stage-backend-vendors.ps1)) |
| `pad-earthwork-vendor/` | `pad-earthwork-planner/` | то же |
| `well-trajectory-vendor/` | `well-trajectory-planner/` | то же |
| `backend/shared/` | `decision-matrix/shared/` | staging + CI deploy |

Vendor и `backend/shared/` **в `.gitignore`** — не коммитить. Pytest CI ставит микросервисы из корня монорепо напрямую (`pip install -e ../../pad-earthwork-planner`).

**Единый источник JSON:** [`decision-matrix/shared/`](../../decision-matrix/shared/) (`infrastructure_subtypes.json`, `l1_extrusion_heights.json`). Редактировать только там; для Docker — staging script.

## `decision-matrix/frontend/src/lib`

Доменные подпапки + **barrel/stub** на старых путях (импорты `../lib/mapClipboard` не меняются):

| Подпапка | Содержание |
|----------|------------|
| `lib/api/` | HTTP-клиент по доменам |
| `lib/map3d/` | 3D-карта, качество, сцена |
| `lib/map2d/` | 2D-карта: clipboard, undo, hitTest, measure, … |
| `lib/padClustering/` | Кластеризация кустов, 3D-сцена, PyWellGeo |
| `lib/wellTrajectory/` | Профиль, clearance, bottomhole |
| `lib/infra/` | Геометрия, links, sand volumes, pad earthwork props |
| `lib/padEarthworkSketch/` | Контур площадки, envelope |

React-контексты вынесены из `lib/`:

- [`contexts/flowSchematicPropagationContext.tsx`](../../decision-matrix/frontend/src/contexts/flowSchematicPropagationContext.tsx) — stub: `lib/flowSchematicContext.tsx`
- [`lib/projectDisplay/`](../../decision-matrix/frontend/src/lib/projectDisplay/) — stub: `lib/projectDisplay.tsx`
- [`components/infra/ieSubtypeIcons.tsx`](../../decision-matrix/frontend/src/components/infra/ieSubtypeIcons.tsx) — stub: `lib/ieSubtypeIcons.tsx`

## Docker dev

```powershell
.\scripts\stage-backend-vendors.ps1
docker compose -f deploy/docker-compose.dev.yml up --build
```

Volumes: `pad_dem`, `map3d_models` (симметрично prod).

## Удалённое legacy

- `decision-matrix/services/autoroad-network/` — заменено на [`autoroad-network-planner/`](../../autoroad-network-planner/)
