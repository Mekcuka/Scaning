"""FastAPI application."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from network_planner import __version__
from network_planner.api.middleware import RequestIdMiddleware
from network_planner.api.routes import router
from network_planner.config.settings import get_settings
from network_planner.logging_config import configure_logging


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    configure_logging(settings.log_level)
    yield


app = FastAPI(
    title="Steiner Network Planner",
    version=__version__,
    description="Euclidean Steiner tree over terminals (start/end roles).",
    lifespan=lifespan,
)

_settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origin_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestIdMiddleware)
app.include_router(router)

_examples = Path(__file__).resolve().parents[3] / "examples"
if _examples.is_dir():
    app.mount("/examples", StaticFiles(directory=_examples), name="examples")
