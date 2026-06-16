"""JSON encoding helpers for HTTP responses (NaN/Inf-safe)."""

from __future__ import annotations

import json
import math
from typing import Any


def sanitize_json_floats(value: Any) -> Any:
    """Replace non-finite floats with ``null`` recursively."""
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value
    if isinstance(value, dict):
        return {k: sanitize_json_floats(v) for k, v in value.items()}
    if isinstance(value, list):
        return [sanitize_json_floats(v) for v in value]
    return value


def json_public_roundtrip(value: Any) -> Any:
    """Encode/decode payload for JSONResponse; NaN/Inf → null, unknown types → str."""
    cleaned = sanitize_json_floats(value)
    return json.loads(json.dumps(cleaned, default=str))
