# Pad Earthwork Planner

HTTP microservice for simplified pad (oil/gas cluster) earthwork volume estimation on flat terrain (MVP).

Интеграция в СППР: [docs/features/pad-earthwork.md](../docs/features/pad-earthwork.md).

## Local development

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
pytest
uvicorn pad_earthwork.api:app --reload --host 0.0.0.0 --port 8081
```

Без `pip install` (добавляет `src/` в PYTHONPATH):

```bash
python run_server.py
```

Health: `GET http://127.0.0.1:8081/health`

## Docker

```bash
docker compose up --build
```

## Monolith

По умолчанию in-process в API (`PAD_EARTHWORK_INPROCESS=true`). Vendor для Docker: `decision-matrix/backend/pad-earthwork-vendor`.

See [docs/MICROSERVICE.md](docs/MICROSERVICE.md) for deployment details.