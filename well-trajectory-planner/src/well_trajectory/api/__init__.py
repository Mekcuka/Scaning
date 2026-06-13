"""ASGI app factory."""

from fastapi import FastAPI

from well_trajectory.api.routes import router

app = FastAPI(title="Well Trajectory Planner", version="0.1.0")
app.include_router(router)
