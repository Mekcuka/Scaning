"""In-memory TTL cache for pad placement compute results."""

from __future__ import annotations

import os
import time
from dataclasses import dataclass, field
from threading import Lock
from uuid import UUID

from app.services.pad_placement.schemas import PadPlacementComputeResponse

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


def _purge_expired_locked() -> None:
    now = time.time()
    expired = [k for k, v in _store.items() if v.expires_at <= now]
    for k in expired:
        _store.pop(k, None)
