"""On-disk paths for project line-profile DEM GeoTIFF."""

from __future__ import annotations

import os
from pathlib import Path
from uuid import UUID

from app.core.config import settings


def line_profile_dem_root() -> Path:
    from app.core.paths import data_dir

    env_root = (settings.LINE_PROFILE_DEM_DATA_ROOT or os.environ.get("LINE_PROFILE_DEM_DATA_ROOT") or "").strip()
    if env_root:
        root = Path(env_root)
        root.mkdir(parents=True, exist_ok=True)
        return root
    return data_dir("line_profile_dem")


def project_dem_file_path(project_id: UUID) -> Path:
    return line_profile_dem_root() / str(project_id) / "dem.tif"


def delete_project_dem_file(project_id: UUID) -> None:
    project_dem_file_path(project_id).unlink(missing_ok=True)
    project_dir = line_profile_dem_root() / str(project_id)
    try:
        project_dir.rmdir()
    except OSError:
        pass
