"""Map 3D custom models — storage, optimization, and BFF handlers."""

from app.services.map3d.api_handlers import (
    handle_apply_preview,
    handle_assign,
    handle_delete,
    handle_get_file,
    handle_list,
    handle_patch,
    handle_upload,
)
from app.services.map3d.optimize import optimize_glb_upload
from app.services.map3d.storage import *  # noqa: F403

__all__ = [
    "handle_apply_preview",
    "handle_assign",
    "handle_delete",
    "handle_get_file",
    "handle_list",
    "handle_patch",
    "handle_upload",
    "optimize_glb_upload",
]
