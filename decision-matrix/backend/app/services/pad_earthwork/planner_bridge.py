"""Lazy import bridge to pad-earthwork-planner (API starts without the package)."""

from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from pad_earthwork.schemas import ComputeRequest, ComputeResponse

_INSTALL_HINT = "pip install -e ../../../pad-earthwork-planner"


@lru_cache(maxsize=1)
def _planner_modules() -> tuple[Any, Any]:
    try:
        from pad_earthwork import compute as compute_mod
        from pad_earthwork import schemas as schemas_mod
    except ImportError as exc:
        raise RuntimeError(
            f"Пакет pad-earthwork-planner не установлен. Выполните: {_INSTALL_HINT}"
        ) from exc
    return compute_mod, schemas_mod


def compute_pad_earthwork(request: ComputeRequest) -> ComputeResponse:
    compute_mod, _ = _planner_modules()
    return compute_mod.compute_pad_earthwork(request)


def dem_not_supported_error() -> type[Exception]:
    compute_mod, _ = _planner_modules()
    return compute_mod.DemNotSupportedError


def profile_not_supported_error() -> type[Exception]:
    from pad_earthwork.volume_profile import ProfileNotSupportedError

    return ProfileNotSupportedError


def preview_sketch_request(body: object) -> object:
    compute_mod, schemas_mod = _planner_modules()
    req = schemas_mod.SketchPreviewRequest.model_validate(body)
    return compute_mod.preview_sketch(req)


def planner_schemas() -> Any:
    _, schemas_mod = _planner_modules()
    return schemas_mod
