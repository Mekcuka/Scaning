"""Pad object guards for well trajectory BFF."""

from __future__ import annotations

from fastapi import HTTPException

from app.models import InfrastructureObject
from app.subtype_manifest import PAD_CLUSTER_SUBTYPES


def assert_pad_object(obj: InfrastructureObject) -> None:
    if obj.subtype not in PAD_CLUSTER_SUBTYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Траектории доступны только для кустов: {sorted(PAD_CLUSTER_SUBTYPES)}",
        )
