# Pad Earthwork Planner

HTTP microservice for simplified pad (oil/gas cluster) earthwork volume estimation on flat terrain (MVP).

## Local development

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
pytest
uvicorn pad_earthwork.api:app --reload --host 0.0.0.0 --port 8081
```

## Docker

```bash
docker compose up --build
```

See [docs/MICROSERVICE.md](docs/MICROSERVICE.md) for deployment details.
