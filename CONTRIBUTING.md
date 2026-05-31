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

Optional full stack via Docker:

```bash
docker compose -f deploy/docker-compose.dev.yml up --build
```

## Checks before PR

```bash
cd decision-matrix/frontend && npm run lint && npm run typecheck && npm run test
cd decision-matrix/frontend && npm run test:coverage   # optional, coverage report
cd decision-matrix/backend && pytest tests/ -q
cd decision-matrix/backend && pytest tests/ --cov=app --cov-report=term-missing
```

CI runs the same checks on pull requests (`.github/workflows/ci.yml`). See [docs/testing-strategy.md](docs/testing-strategy.md) for coverage baseline and conventions.

## Pre-commit (optional)

```bash
pip install pre-commit
pre-commit install
```

## Code style

- Backend: `ruff check` / `ruff format` on `decision-matrix/backend`
- Frontend: ESLint with TypeScript type-checked rules
- Keep changes focused; match existing patterns in neighboring files
