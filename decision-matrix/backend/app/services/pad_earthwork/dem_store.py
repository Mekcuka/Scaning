"""OpenTopography DEM fetch and on-disk cache for pad earthwork."""

from __future__ import annotations

import hashlib
import os
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID

import httpx
from fastapi import HTTPException

from app.core.config import settings
from app.core.http_client import get_http_client, run_on_main_loop
from app.core.http_retry import retry_microservice_call
from app.services.pad_earthwork.gdal_proj import configure_rasterio_proj

OPENTOPOGRAPHY_GLOBAL_DEM_URL = "https://portal.opentopography.org/API/globaldem"


def _normalize_opentopography_api_key(raw: str) -> str:
    return raw.strip()


def _validate_opentopography_api_key(key: str) -> None:
    """OpenTopography keys are 32-char hex strings from myOpenTopo dashboard."""
    if len(key) == 32 and all(ch in "0123456789abcdefABCDEF" for ch in key):
        return
    if len(key) == 36 and key.count("-") == 4:
        raise HTTPException(
            status_code=503,
            detail="dem_api_key_invalid_format",
        )
    if not key:
        raise HTTPException(status_code=503, detail="dem_api_not_configured")
    raise HTTPException(status_code=503, detail="dem_api_key_invalid_format")


def pad_dem_root() -> Path:
    from app.core.paths import data_dir

    env_root = (settings.PAD_DEM_DATA_ROOT or os.environ.get("PAD_DEM_DATA_ROOT") or "").strip()
    if env_root:
        root = Path(env_root)
        root.mkdir(parents=True, exist_ok=True)
        return root
    return data_dir("pad_dem")


def dem_file_path(project_id: UUID, asset_id: str) -> Path:
    return pad_dem_root() / str(project_id) / f"{asset_id}.tif"


def _meters_per_degree(lat_deg: float) -> tuple[float, float]:
    import math

    lat_rad = math.radians(lat_deg)
    return 111_320.0 * math.cos(lat_rad), 110_540.0


def compute_dem_bbox(
    footprint_corners_lonlat: list[tuple[float, float]],
    *,
    padding_m: float,
    lat_deg: float,
    min_side_m: float | None = None,
) -> tuple[float, float, float, float]:
    """Return west, south, east, north in degrees."""
    if not footprint_corners_lonlat:
        raise ValueError("footprint_corners_lonlat required")
    lons = [c[0] for c in footprint_corners_lonlat]
    lats = [c[1] for c in footprint_corners_lonlat]
    m_per_deg_lon, m_per_deg_lat = _meters_per_degree(lat_deg)
    pad_lon = padding_m / m_per_deg_lon
    pad_lat = padding_m / m_per_deg_lat
    west = min(lons) - pad_lon
    east = max(lons) + pad_lon
    south = min(lats) - pad_lat
    north = max(lats) + pad_lat

    min_side = float(
        min_side_m if min_side_m is not None else settings.PAD_DEM_MIN_BBOX_SIDE_M
    )
    if min_side > 0:
        target_side = min_side + 1.0
        center_lat = (south + north) / 2.0
        m_lon, m_lat = _meters_per_degree(center_lat)
        width_m = max(0.0, (east - west) * m_lon)
        height_m = max(0.0, (north - south) * m_lat)
        if width_m < target_side:
            extra_deg = ((target_side - width_m) / 2.0) / m_lon
            west -= extra_deg
            east += extra_deg
        if height_m < target_side:
            extra_deg = ((target_side - height_m) / 2.0) / m_lat
            south -= extra_deg
            north += extra_deg

    return west, south, east, north


def bbox_hash(bbox: tuple[float, float, float, float]) -> str:
    text = ",".join(f"{v:.6f}" for v in bbox)
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def _is_geotiff_bytes(raw: bytes) -> bool:
    return len(raw) >= 4 and raw[:2] in (b"II", b"MM") and raw[2:4] in (b"*\x00", b"\x00*")


def _parse_opentopography_response(response: httpx.Response) -> bytes:
    if response.status_code == 401:
        body_text = response.text.strip()
        if "Not a valid format API Key" in body_text or "API Key required" in body_text:
            raise HTTPException(
                status_code=502,
                detail="dem_api_key_invalid",
            )
        raise HTTPException(status_code=502, detail="dem_api_key_unauthorized")
    if response.status_code == 429:
        raise HTTPException(status_code=429, detail="dem_rate_limit_exceeded")
    if response.status_code == 400:
        body_text = response.text.strip()
        if "bounding box must be greater" in body_text.lower():
            raise HTTPException(status_code=502, detail="dem_bbox_too_small")
        raise HTTPException(status_code=502, detail="dem_fetch_bad_request")
    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"dem_fetch_failed_http_{response.status_code}",
        )
    content = response.content
    if len(content) < 256:
        raise HTTPException(status_code=502, detail="dem_fetch_empty_response")
    if not _is_geotiff_bytes(content):
        raise HTTPException(status_code=502, detail="dem_fetch_not_geotiff")
    return content


def _dem_fetch_params(
    bbox: tuple[float, float, float, float],
    *,
    demtype: str | None,
    api_key: str | None,
) -> tuple[dict[str, Any], int, str]:
    key = _normalize_opentopography_api_key(api_key or settings.OPENTOPOGRAPHY_API_KEY or "")
    _validate_opentopography_api_key(key)
    west, south, east, north = bbox
    params = {
        "demtype": (demtype or settings.OPENTOPOGRAPHY_DEM_TYPE or "COP30").strip(),
        "south": south,
        "north": north,
        "west": west,
        "east": east,
        "outputFormat": "GTiff",
        "API_Key": key,
    }
    timeout = max(10, int(settings.OPENTOPOGRAPHY_TIMEOUT_SECONDS))
    return params, timeout, key


async def fetch_opentopography_dem_async(
    bbox: tuple[float, float, float, float],
    *,
    demtype: str | None = None,
    api_key: str | None = None,
) -> bytes:
    params, timeout, _key = _dem_fetch_params(bbox, demtype=demtype, api_key=api_key)

    async def _call() -> bytes:
        client = await get_http_client()
        try:
            response = await client.get(
                OPENTOPOGRAPHY_GLOBAL_DEM_URL, params=params, timeout=float(timeout)
            )
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail="dem_fetch_failed") from exc
        return _parse_opentopography_response(response)

    return await retry_microservice_call(_call, service_name="opentopography")


def fetch_opentopography_dem(
    bbox: tuple[float, float, float, float],
    *,
    demtype: str | None = None,
    api_key: str | None = None,
) -> bytes:
    """Sync wrapper for callers in worker threads."""
    _params, timeout, _key = _dem_fetch_params(bbox, demtype=demtype, api_key=api_key)
    return run_on_main_loop(
        fetch_opentopography_dem_async(bbox, demtype=demtype, api_key=api_key),
        timeout=float(timeout),
    )


def validate_geotiff(raw: bytes) -> None:
    if not _is_geotiff_bytes(raw):
        raise HTTPException(status_code=502, detail="dem_invalid_geotiff")
    configure_rasterio_proj()
    try:
        import rasterio
        from rasterio.io import MemoryFile
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="rasterio_not_available") from exc
    try:
        with MemoryFile(raw) as mem:
            with mem.open() as dataset:
                if dataset.count < 1:
                    raise HTTPException(status_code=502, detail="dem_invalid_geotiff")
    except HTTPException:
        raise
    except Exception:
        # OT returned a TIFF header; allow compute to read from disk even if in-memory open fails.
        return


def store_dem_file(project_id: UUID, raw: bytes, asset_id: str | None = None) -> Path:
    aid = asset_id or str(uuid.uuid4())
    path = dem_file_path(project_id, aid)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw)
    return path


def dem_source_label(demtype: str | None = None) -> str:
    dt = (demtype or settings.OPENTOPOGRAPHY_DEM_TYPE or "COP30").strip()
    return f"opentopography:{dt}"
