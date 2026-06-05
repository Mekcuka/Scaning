"""HTTP routes."""



import os



from fastapi import APIRouter, HTTPException, Response

from pydantic import ValidationError

from network_planner.config.settings import get_settings
from network_planner.plan.pipeline import (
    plan_from_request_geosteiner,
    plan_from_request_steinerpy,
)
from network_planner.schemas.io import (
    GeoSteinerStatusOut,
    PlanRequest,
    PlanResponse,
    ReadinessOut,
    SteinerPyStatusOut,
)

from network_planner.steiner.geosteiner import (

    GeoSteinerNotAvailableError,

    GeoSteinerRunError,

    is_geosteiner_available,

    resolve_geosteiner_paths,

)

from network_planner.steiner.geosteiner.config import geosteiner_runtime_path

from network_planner.steiner.steinerpy import (

    SteinerPyNotAvailableError,

    SteinerPyRunError,

    is_steinerpy_available,

)



router = APIRouter()





@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready", response_model=ReadinessOut)
def ready(response: Response) -> ReadinessOut:
    settings = get_settings()
    steinerpy_ok = is_steinerpy_available()
    geosteiner_ok = is_geosteiner_available()
    is_ready = steinerpy_ok if settings.require_steinerpy else True
    body = ReadinessOut(
        status="ok" if is_ready else "not_ready",
        steinerpy=steinerpy_ok,
        geosteiner=geosteiner_ok,
    )
    if not is_ready:
        response.status_code = 503
    return body


@router.get("/v1/geosteiner/status", response_model=GeoSteinerStatusOut)

def geosteiner_status() -> GeoSteinerStatusOut:

    paths = resolve_geosteiner_paths()

    runtime = geosteiner_runtime_path()

    if paths is None:

        return GeoSteinerStatusOut(available=False, runtime_path=runtime)

    ready = runtime is not None or os.name != "nt"

    return GeoSteinerStatusOut(

        available=ready,

        bin_dir=str(paths.bin_dir),

        efst=str(paths.efst),

        bb=str(paths.bb),

        runtime_path=runtime,

    )





@router.get("/v1/steinerpy/status", response_model=SteinerPyStatusOut)

def steinerpy_status() -> SteinerPyStatusOut:

    return SteinerPyStatusOut(available=is_steinerpy_available())





@router.post("/v1/plan/steinerpy", response_model=PlanResponse)

def plan_steinerpy(req: PlanRequest) -> PlanResponse:

    """Steiner tree via SteinerPy (pip package steinerpy + HiGHS)."""

    if not is_steinerpy_available():

        raise HTTPException(

            status_code=503,

            detail=(

                "SteinerPy is not installed. See GET /v1/steinerpy/status — "

                "pip install steinerpy"

            ),

        )

    try:

        return plan_from_request_steinerpy(req)

    except ValidationError as exc:

        raise HTTPException(status_code=422, detail=exc.errors()) from exc

    except ValueError as exc:

        raise HTTPException(status_code=422, detail=str(exc)) from exc

    except SteinerPyNotAvailableError as exc:

        raise HTTPException(status_code=503, detail=str(exc)) from exc

    except SteinerPyRunError as exc:

        raise HTTPException(status_code=502, detail=str(exc)) from exc





@router.post("/v1/plan/geosteiner", response_model=PlanResponse)

def plan_geosteiner(req: PlanRequest) -> PlanResponse:

    """Exact Euclidean Steiner tree via GeoSteiner (external binaries required)."""

    if not is_geosteiner_available():

        raise HTTPException(

            status_code=503,

            detail=(

                "GeoSteiner is not installed. See GET /v1/geosteiner/status and "

                "scripts/build_geosteiner.sh."

            ),

        )

    try:

        return plan_from_request_geosteiner(req)

    except ValidationError as exc:

        raise HTTPException(status_code=422, detail=exc.errors()) from exc

    except ValueError as exc:

        raise HTTPException(status_code=422, detail=str(exc)) from exc

    except GeoSteinerNotAvailableError as exc:

        raise HTTPException(status_code=503, detail=str(exc)) from exc

    except GeoSteinerRunError as exc:

        raise HTTPException(status_code=502, detail=str(exc)) from exc

