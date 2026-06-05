FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md ./
COPY src ./src
COPY examples ./examples

RUN pip install --no-cache-dir ".[steinerpy]"

ENV APP_HOST=0.0.0.0 \
    APP_PORT=8080 \
    LOG_LEVEL=INFO \
    CORS_ORIGINS=* \
    REQUIRE_STEINERPY=true

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

CMD uvicorn network_planner.api:app --host ${APP_HOST} --port ${APP_PORT}
