"""API v1 router composition — domain routes live in dedicated modules."""

from fastapi import APIRouter, Depends

from app.api.deps import verify_csrf
from app.api.v1.admin import admin_router
from app.api.v1.admin_jobs import admin_jobs_router
from app.api.v1.analysis import analysis_router
from app.api.v1.auth import auth_router
from app.api.v1.autoroad_network import autoroad_network_router
from app.api.v1.flow import flow_router
from app.api.v1.graph import graph_router
from app.api.v1.import_connections import connections_router
from app.api.v1.jobs import jobs_router
from app.api.v1.map import map_router
from app.api.v1.one_pagers import one_pagers_router
from app.api.v1.projects import projects_router
from app.api.v1.sand_logistics import sand_logistics_router

router = APIRouter(dependencies=[Depends(verify_csrf)])
router.include_router(auth_router)
router.include_router(admin_router)
router.include_router(admin_jobs_router)
router.include_router(projects_router)
router.include_router(analysis_router)
router.include_router(one_pagers_router)
router.include_router(map_router)
router.include_router(autoroad_network_router)
router.include_router(graph_router)
router.include_router(flow_router)
router.include_router(connections_router)
router.include_router(sand_logistics_router)
router.include_router(jobs_router)
