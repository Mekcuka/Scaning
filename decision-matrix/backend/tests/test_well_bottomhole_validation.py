"""Tests for bottomhole role validation."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.models import InfrastructureObject
from app.services.well_trajectory.bottomhole_properties import LINKED_PAD_ID, PARENT_ID
from app.services.well_trajectory.bottomhole_validation import (
    resolve_bottomhole_delete_cascade,
    validate_bottomhole_can_delete,
    validate_bottomhole_object,
)


def _main_bh(**props) -> InfrastructureObject:
    return InfrastructureObject(
        id=uuid4(),
        layer_id=uuid4(),
        name="Main",
        subtype="well_bottomhole_nnb",
        category="well",
        geometry={"type": "Point", "coordinates": [0, 0]},
        longitude=0,
        latitude=0,
        properties={"well_bottomhole_role": "main", **props},
    )


def test_lateral_requires_parent_id():
    db = AsyncMock()
    with pytest.raises(ValueError, match="parent_id"):
        asyncio.run(
            validate_bottomhole_object(
                db,
                project_id=uuid4(),
                subtype="well_bottomhole_nnb",
                properties={"well_bottomhole_role": "lateral"},
            )
        )


def test_main_cannot_have_parent_id():
    db = AsyncMock()
    with pytest.raises(ValueError, match="parent_id"):
        asyncio.run(
            validate_bottomhole_object(
                db,
                project_id=uuid4(),
                subtype="well_bottomhole_nnb",
                properties={
                    "well_bottomhole_role": "main",
                    PARENT_ID: str(uuid4()),
                },
            )
        )


def test_lateral_inherits_pad_from_parent():
    db = AsyncMock()
    pad_id = uuid4()
    parent_id = uuid4()
    parent = _main_bh(**{LINKED_PAD_ID: str(pad_id), "well_bottomhole_well_index": 1})

    async def _get_object(_db, _project_id, _object_id):
        if _object_id == parent_id:
            return parent
        return None

    with patch(
        "app.services.well_trajectory.bottomhole_validation._get_object_in_project",
        side_effect=_get_object,
    ):
        props = asyncio.run(
            validate_bottomhole_object(
                db,
                project_id=uuid4(),
                subtype="well_bottomhole_nnb",
                properties={
                    "well_bottomhole_role": "lateral",
                    PARENT_ID: str(parent_id),
                },
            )
        )
    assert props[LINKED_PAD_ID] == str(pad_id)
    assert props["well_bottomhole_well_index"] == 1


def test_validate_bottomhole_can_delete_blocks_main_with_laterals():
    main = _main_bh()
    db = AsyncMock()

    with patch(
        "app.services.well_trajectory.bottomhole_validation._count_laterals_for_parent",
        new=AsyncMock(return_value=1),
    ):
        with pytest.raises(ValueError, match="доп.ствол"):
            asyncio.run(
                validate_bottomhole_can_delete(
                    db,
                    project_id=uuid4(),
                    obj=main,
                )
            )


def test_validate_bottomhole_can_delete_allows_main_when_laterals_in_delete_set():
    main = _main_bh()
    db = AsyncMock()

    with patch(
        "app.services.well_trajectory.bottomhole_validation._count_laterals_for_parent",
        new=AsyncMock(return_value=0),
    ):
        asyncio.run(
            validate_bottomhole_can_delete(
                db,
                project_id=uuid4(),
                obj=main,
                delete_ids={main.id, uuid4()},
            )
        )


def test_resolve_bottomhole_delete_cascade_includes_laterals():
    project_id = uuid4()
    main_id = uuid4()
    lateral_id = uuid4()
    main = _main_bh()
    main.id = main_id
    lateral = InfrastructureObject(
        id=lateral_id,
        layer_id=uuid4(),
        name="Lat",
        subtype="well_bottomhole_nnb",
        category="well",
        geometry={"type": "Point", "coordinates": [0, 0]},
        longitude=0,
        latitude=0,
        properties={
            "well_bottomhole_role": "lateral",
            PARENT_ID: str(main_id),
        },
    )

    async def _run():
        db = AsyncMock()
        db.execute = AsyncMock(
            return_value=MagicMock(
                scalars=MagicMock(
                    return_value=MagicMock(all=MagicMock(return_value=[main, lateral]))
                )
            )
        )
        return await resolve_bottomhole_delete_cascade(db, project_id, {main_id})

    expanded = asyncio.run(_run())
    assert expanded == {main_id, lateral_id}
