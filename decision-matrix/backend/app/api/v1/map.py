"""Map module API composition — layers, objects, POI, import (FR-2.x)."""

from fastapi import APIRouter

from app.api.v1.map3d_models import map3d_custom_models_router
from app.api.v1.map_import import import_router
from app.api.v1.map_layers import layers_router
from app.api.v1.map_objects import objects_router
from app.api.v1.map_poi import poi_router
from app.api.v1.line_elevation_profile import line_elevation_profile_router
from app.api.v1.pad_earthwork import pad_earthwork_router
from app.api.v1.pywellgeo import pywellgeo_router
from app.api.v1.well_trajectory import well_trajectory_router

# Backward-compatible re-exports
from app.api.v1.map_deps import (  # noqa: F401
    get_infra_object,
    get_layer,
    get_or_create_default_layer,
    get_poi,
    get_user_project,
    require_infra_write,
    require_project_write,
    get_user_project as _get_user_project,
    require_infra_write as _require_infra_write,
    require_project_write as _require_project_write,
    get_poi as _get_poi,
    get_layer as _get_layer,
    get_infra_object as _get_infra_object,
    get_or_create_default_layer as _get_or_create_default_layer,
)
from app.services.infra_create import (  # noqa: F401
    create_infra_object_record,
    create_infra_object_record as _create_infra_object_record,
)
from app.services.infra_update import (  # noqa: F401
    update_infra_object_record,
    update_infra_object_record as _update_infra_object_record,
)

map_router = APIRouter()
map_router.include_router(layers_router)
map_router.include_router(objects_router)
map_router.include_router(poi_router)
map_router.include_router(import_router)
map_router.include_router(map3d_custom_models_router)
map_router.include_router(pad_earthwork_router)
map_router.include_router(line_elevation_profile_router)
map_router.include_router(well_trajectory_router)
map_router.include_router(pywellgeo_router)
