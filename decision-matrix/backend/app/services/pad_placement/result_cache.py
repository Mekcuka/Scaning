"""In-memory TTL cache for pad placement compute results."""

from __future__ import annotations

import os
import time
from dataclasses import dataclass, field
from threading import Lock
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.pad_placement.schemas import (
    BottomholeSnapshot,
    PadPlacementComputeResponse,
    PadPlacementParams,
)

_DEFAULT_TTL_HOURS = 24.0


def _ttl_seconds() -> float:
    raw = os.environ.get("PAD_PLACEMENT_CACHE_TTL_HOURS", str(_DEFAULT_TTL_HOURS))
    try:
        return float(raw) * 3600.0
    except ValueError:
        return _DEFAULT_TTL_HOURS * 3600.0


@dataclass
class _CacheEntry:
    response: PadPlacementComputeResponse
    expires_at: float
    snapshots: list = field(default_factory=list)
    subtype: str = "oil_pad"
    params: Any = None
    compute_request: Any = None


_lock = Lock()
_store: dict[UUID, _CacheEntry] = {}


def put(
    request_id: UUID,
    response: PadPlacementComputeResponse,
    *,
    snapshots: list | None = None,
    subtype: str = "oil_pad",
    params: Any = None,
    compute_request: Any = None,
) -> None:
    with _lock:
        _purge_expired_locked()
        _store[request_id] = _CacheEntry(
            response=response,
            expires_at=time.time() + _ttl_seconds(),
            snapshots=list(snapshots or []),
            subtype=subtype,
            params=params,
            compute_request=compute_request,
        )


def get(request_id: UUID) -> _CacheEntry | None:
    with _lock:
        _purge_expired_locked()
        entry = _store.get(request_id)
        if entry is None:
            return None
        if entry.expires_at <= time.time():
            _store.pop(request_id, None)
            return None
        return entry


def pop(request_id: UUID) -> _CacheEntry | None:
    with _lock:
        return _store.pop(request_id, None)


def hydrate_from_job_payload(result: dict[str, Any]) -> bool:
    """Restore cache entry from async job result (multi-process / worker compute)."""
    raw_id = result.get("request_id")
    if raw_id is None:
        return False
    request_id = UUID(str(raw_id))
    if get(request_id) is not None:
        return True
    meta = result.get("cache_meta")
    if not isinstance(meta, dict):
        return False
    response_payload = {k: v for k, v in result.items() if k != "cache_meta"}
    response = PadPlacementComputeResponse.model_validate(response_payload)
    snapshots = [
        BottomholeSnapshot.model_validate(item) for item in (meta.get("snapshots") or [])
    ]
    subtype = str(meta.get("subtype") or "oil_pad")
    params_raw = meta.get("params") or {}
    params = (
        PadPlacementParams.model_validate(params_raw)
        if isinstance(params_raw, dict)
        else PadPlacementParams()
    )
    put(request_id, response, snapshots=snapshots, subtype=subtype, params=params)
    return True


async def ensure_cached_from_jobs(
    db: AsyncSession,
    project_id: UUID,
    request_id: UUID,
) -> _CacheEntry | None:
    """Return cache entry, hydrating from completed compute jobs when needed."""
    entry = get(request_id)
    if entry is not None:
        return entry

    from app.models import ProjectJob
    from app.services.project_jobs import JOB_STATUS_COMPLETED, JOB_TYPE_PAD_PLACEMENT_COMPUTE

    rows = await db.scalars(
        select(ProjectJob)
        .where(
            ProjectJob.project_id == project_id,
            ProjectJob.job_type == JOB_TYPE_PAD_PLACEMENT_COMPUTE,
            ProjectJob.status == JOB_STATUS_COMPLETED,
        )
        .order_by(ProjectJob.finished_at.desc())
        .limit(25)
    )
    for job in rows:
        result = job.result or {}
        if str(result.get("request_id")) != str(request_id):
            continue
        if hydrate_from_job_payload(result):
            return get(request_id)
    return None


def _purge_expired_locked() -> None:
    now = time.time()
    expired = [k for k, v in _store.items() if v.expires_at <= now]
    for k in expired:
        _store.pop(k, None)
