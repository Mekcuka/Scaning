"""ASGI app factory."""

from fastapi import FastAPI

from pad_earthwork.api.routes import router

app = FastAPI(title="Pad Earthwork Planner", version="0.1.0")
app.include_router(router)
