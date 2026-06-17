# Contributing to СППР Нефтегаз

## Prerequisites

- Python 3.12+
- Node.js 22 (see `.nvmrc`)
- PostgreSQL + PostGIS for full map features, or SQLite for quick backend dev

## Setup

```bash
# Backend (SQLite)
cd decision-matrix/backend
pip install -r requirements.txt -r requirements-dev.txt
python run_local.py

# Frontend
cd decision-matrix/frontend
npm ci
npm run dev
```

Optional full stack via Docker (stage vendor copies first — dirs are gitignored, not stored in the repo):

```bash
# From repo root
./scripts/stage-backend-vendors.sh   # or .\scripts\stage-backend-vendors.ps1 on Windows
docker compose -f deploy/docker-compose.dev.yml up --build
```

Pytest CI installs microservices from repo root (`autoroad-network-planner/`, etc.) directly — no vendor staging needed for local pytest.

## Checks before PR

```bash
cd decision-matrix/frontend && npm run lint && npm run typecheck && npm run test
cd decision-matrix/frontend && npm run test:coverage   # optional, coverage report
cd decision-matrix/backend && pytest tests/ -q
cd decision-matrix/backend && pytest tests/ --cov=app --cov-report=term-missing
```

CI runs the same checks on pull requests (`.github/workflows/ci.yml`). See [docs/testing/testing-strategy.md](docs/testing/testing-strategy.md) for coverage baseline and conventions.

## Pre-commit (optional)

```bash
pip install pre-commit
pre-commit install
```

## Code style

- Backend: `ruff check` / `ruff format` on `decision-matrix/backend`
- Frontend: ESLint with TypeScript type-checked rules (**0 errors, 0 warnings** — CI fails on warnings)
- OpenLayers `mapView/**`: `react-hooks/exhaustive-deps` отключён в `eslint.config.js` (стабильные ref-колбэки OL)
- Keep changes focused; match existing patterns in neighboring files

## Module boundaries (SOLID)

See [docs/architecture/module-boundaries.md](docs/architecture/module-boundaries.md) and [docs/planning/solid-refactoring-plan.md](docs/planning/solid-refactoring-plan.md).

Microservices in the monorepo follow the same in-process vendor + optional HTTP pattern: `pad-earthwork-planner/`, `autoroad-network-planner/`, `well-trajectory-planner/` (в планах — см. [docs/features/well-trajectory/well-trajectory.md](docs/features/well-trajectory/well-trajectory.md)).

- New or substantially extended files should stay **≤ 300–400 lines**; split into a separate module otherwise.
- One PR = one structural goal; do not mix refactoring with feature work.
- Preserve public barrel imports (`lib/api`, `useMapPageOrchestrator`, etc.) when splitting files.

### Refactoring PR checklist

- [ ] Behavior unchanged (unit tests; E2E if map/import/auth touched)
- [ ] Public imports still work (barrels)
- [ ] New/changed module ≤ 400 lines (or justified in PR description)
- [ ] No empty abstractions without a second implementation
- [ ] Docs updated if folder structure changed
- [ ] CI green (lint, typecheck, vitest, pytest)
