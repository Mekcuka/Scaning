FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md ./
COPY src ./src

RUN pip install --no-cache-dir .

ENV APP_HOST=0.0.0.0 \
    APP_PORT=8082

EXPOSE 8082

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8082/health || exit 1

CMD uvicorn well_trajectory.api:app --host ${APP_HOST} --port ${APP_PORT}
