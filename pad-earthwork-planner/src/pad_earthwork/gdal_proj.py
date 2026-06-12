"""Isolate rasterio/GDAL PROJ from system PostGIS installs on Windows."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def configure_rasterio_proj() -> None:
    """Point PROJ at rasterio/pyproj wheel data instead of PostGIS PROJ."""
    candidates: list[Path] = []
    try:
        import rasterio

        root = Path(rasterio.__file__).resolve().parent
        candidates.extend([root / "proj_data", root / "gdal_data"])
    except Exception:
        pass
    try:
        import pyproj.datadir

        candidates.append(Path(pyproj.datadir.get_data_dir()))
    except Exception:
        pass

    for path in candidates:
        if path.is_dir():
            text = str(path)
            os.environ["PROJ_DATA"] = text
            os.environ["PROJ_LIB"] = text
            return
