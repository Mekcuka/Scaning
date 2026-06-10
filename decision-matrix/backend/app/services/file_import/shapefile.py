"""Shapefile ZIP → GeoJSON conversion via ogr2ogr."""

from __future__ import annotations

import subprocess
import tempfile
import zipfile
from pathlib import Path


def shapefile_zip_to_geojson_bytes(data: bytes) -> tuple[str | None, str | None]:
    with tempfile.TemporaryDirectory() as tmp:
        zpath = Path(tmp) / "upload.zip"
        zpath.write_bytes(data)
        with zipfile.ZipFile(zpath) as zf:
            zf.extractall(tmp)
        shp = next(Path(tmp).rglob("*.shp"), None)
        if not shp:
            return None, "No .shp file in archive"
        out = Path(tmp) / "out.geojson"
        try:
            subprocess.run(
                ["ogr2ogr", "-f", "GeoJSON", str(out), str(shp)],
                check=True,
                capture_output=True,
                timeout=120,
            )
        except (FileNotFoundError, subprocess.CalledProcessError) as e:
            return None, f"ogr2ogr failed: {e}"
        if not out.exists():
            return None, "ogr2ogr produced no output"
        return out.read_text(encoding="utf-8"), None
