"""ORM listeners for pad DEM file cleanup."""

from __future__ import annotations

import logging

from sqlalchemy import event

from app.models import InfraObjectPadDem
from app.services.pad_earthwork.dem_store import dem_file_path

logger = logging.getLogger(__name__)


@event.listens_for(InfraObjectPadDem, "after_delete")
def _delete_pad_dem_file(_mapper, _connection, target: InfraObjectPadDem) -> None:
    try:
        path = dem_file_path(target.project_id, str(target.id))
        path.unlink(missing_ok=True)
    except OSError:
        logger.warning("Failed to delete pad DEM file for asset %s", target.id, exc_info=True)
