"""HTTP handlers for PyWellGeo BFF."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import InfrastructureObject, User
from app.schemas import InfraObjectUpdate
from app.services.infra_update import update_infra_object_record
from app.services.well_trajectory.api_common import read_pad_for_read, read_pad_for_write, run_planner_async
from app.services.well_trajectory.design_lateral import design_lateral_xyz, parse_bottomhole_ref
from app.services.well_trajectory.pywellgeo_public import add_branch_response_json
from app.services.well_trajectory.pywellgeo_ops import (
    add_branch_to_tree,
    apply_geometry_to_trajectory,
    build_last_response,
    coarsen_tree,
    compute_tree,
    export_yaml_from_tree,
    import_yaml_to_tree,
    merge_trees_put,
    plot_data_for_well,
    split_tree_at_z,
    sync_from_survey,
)
from app.services.well_trajectory.trajectory_store import read_trajectories_json
from app.services.well_trajectory.pywellgeo_schemas import (
    PyWellGeoAddBranchRequest,
    PyWellGeoApplyGeometryRequest,
    PyWellGeoApplyGeometryResponse,
    PyWellGeoAzimDipRequest,
    PyWellGeoAzimDipResponse,
    PyWellGeoCoarsenRequest,
    PyWellGeoCoarsenResponse,
    PyWellGeoComputeRequest,
    PyWellGeoComputeResponse,
    PyWellGeoCoordinateTransformRequest,
    PyWellGeoDc1dBuildRequest,
    PyWellGeoLastResponse,
    PyWellGeoPlotDataRequest,
    PyWellGeoPlotDataResponse,
    PyWellGeoSplitAtZRequest,
    PyWellGeoSplitAtZResponse,
    PyWellGeoSyncFromSurveyRequest,
    PyWellGeoSyncFromSurveyResponse,
    PyWellGeoTreeRecord,
    PyWellGeoTreesPutRequest,
    PyWellGeoWaterPropertiesRequest,
    PyWellGeoWaterPropertiesResponse,
    PyWellGeoYamlExportRequest,
    PyWellGeoYamlExportResponse,
    PyWellGeoYamlImportRequest,
)
from app.services.well_trajectory.planner_bridge import run_pywellgeo


async def handle_pywellgeo_get_last(
    project_id: UUID,
    object_id: UUID,
    user: User,
    db: AsyncSession,
) -> PyWellGeoLastResponse:
    obj = await read_pad_for_read(project_id, object_id, user, db)
    return build_last_response(obj.properties)


async def handle_pywellgeo_put_trees(
    project_id: UUID,
    object_id: UUID,
    body: PyWellGeoTreesPutRequest,
    user: User,
    db: AsyncSession,
) -> PyWellGeoLastResponse:
    project, obj = await read_pad_for_write(project_id, object_id, user, db)
    props = merge_trees_put(obj.properties, body)
    await update_infra_object_record(
        db,
        project=project,
        project_id=project_id,
        user=user,
        obj=obj,
        data=InfraObjectUpdate(properties=props),
    )
    await db.commit()
    await db.refresh(obj)
    return build_last_response(obj.properties)


async def handle_sync_from_survey(
    project_id: UUID,
    object_id: UUID,
    body: PyWellGeoSyncFromSurveyRequest,
    user: User,
    db: AsyncSession,
) -> PyWellGeoSyncFromSurveyResponse:
    await read_pad_for_read(project_id, object_id, user, db)
    obj = await read_pad_for_read(project_id, object_id, user, db)
    return sync_from_survey(
        obj.properties,
        well_index=body.well_index,
        radius_m=body.radius_m,
    )


async def handle_compute(
    project_id: UUID,
    object_id: UUID,
    body: PyWellGeoComputeRequest,
    user: User,
    db: AsyncSession,
) -> PyWellGeoComputeResponse:
    obj = await read_pad_for_read(project_id, object_id, user, db)
    tree_override = body.tree.model_dump(mode="json") if body.tree is not None else None
    return compute_tree(
        obj.properties,
        well_index=body.well_index,
        tsurface_c=body.tsurface_c,
        tgrad_c_per_m=body.tgrad_c_per_m,
        tree_override=tree_override,
    )


async def handle_plot_data(
    project_id: UUID,
    object_id: UUID,
    well_index: int,
    user: User,
    db: AsyncSession,
    *,
    tree_override: dict | None = None,
) -> PyWellGeoPlotDataResponse:
    obj = await read_pad_for_read(project_id, object_id, user, db)
    return plot_data_for_well(obj.properties, well_index, tree_override=tree_override)


async def handle_plot_data_post(
    project_id: UUID,
    object_id: UUID,
    body: PyWellGeoPlotDataRequest,
    user: User,
    db: AsyncSession,
) -> PyWellGeoPlotDataResponse:
    tree_override = body.tree.model_dump(mode="json") if body.tree is not None else None
    return await handle_plot_data(
        project_id,
        object_id,
        body.well_index,
        user,
        db,
        tree_override=tree_override,
    )


async def handle_apply_geometry(
    project_id: UUID,
    object_id: UUID,
    body: PyWellGeoApplyGeometryRequest,
    user: User,
    db: AsyncSession,
) -> PyWellGeoApplyGeometryResponse:
    project, obj = await read_pad_for_write(project_id, object_id, user, db)
    tree_override = body.tree.model_dump(mode="json") if body.tree is not None else None
    props, response = apply_geometry_to_trajectory(
        obj.properties,
        well_index=body.well_index,
        tree_override=tree_override,
    )
    await update_infra_object_record(
        db,
        project=project,
        project_id=project_id,
        user=user,
        obj=obj,
        data=InfraObjectUpdate(properties=props),
    )
    await db.commit()
    return response


async def handle_yaml_import(
    project_id: UUID,
    object_id: UUID,
    body: PyWellGeoYamlImportRequest,
    user: User,
    db: AsyncSession,
) -> PyWellGeoTreeRecord:
    await read_pad_for_read(project_id, object_id, user, db)
    obj = await read_pad_for_read(project_id, object_id, user, db)
    return import_yaml_to_tree(
        obj.properties,
        content=body.content,
        format=body.format,
        well_index=body.well_index,
        well_key=body.well_key,
        radius_m=body.radius_m,
    )


async def handle_yaml_import_file(
    project_id: UUID,
    object_id: UUID,
    well_index: int,
    format: str,
    file: UploadFile,
    user: User,
    db: AsyncSession,
) -> PyWellGeoTreeRecord:
    await read_pad_for_read(project_id, object_id, user, db)
    obj = await read_pad_for_read(project_id, object_id, user, db)
    raw = await file.read()
    content = raw.decode("utf-8", errors="replace")
    return import_yaml_to_tree(
        obj.properties,
        content=content,
        format=format,
        well_index=well_index,
        well_key=None,
        radius_m=None,
    )


async def handle_yaml_export(
    project_id: UUID,
    object_id: UUID,
    body: PyWellGeoYamlExportRequest,
    user: User,
    db: AsyncSession,
) -> PyWellGeoYamlExportResponse:
    obj = await read_pad_for_read(project_id, object_id, user, db)
    tree_override = body.tree.model_dump(mode="json") if body.tree is not None else None
    return export_yaml_from_tree(
        obj.properties,
        well_index=body.well_index,
        format=body.format,
        well_name=body.well_name,
        tree_override=tree_override,
    )


async def handle_add_branch(
    project_id: UUID,
    object_id: UUID,
    body: PyWellGeoAddBranchRequest,
    user: User,
    db: AsyncSession,
) -> JSONResponse:
    obj = await read_pad_for_read(project_id, object_id, user, db)
    warnings: list[str] = []
    xyz = body.xyz

    if body.design_with_welleng:
        trajectories = read_trajectories_json(obj.properties)
        if body.well_index >= len(trajectories):
            raise HTTPException(status_code=400, detail=f"well_index {body.well_index} out of range")
        well = trajectories[body.well_index]
        if not isinstance(well, dict):
            raise HTTPException(status_code=400, detail="Нет траектории для выбранной скважины")

        bottomhole_id, endpoint = parse_bottomhole_ref(body.bottomhole_ref or "")
        bottomhole = await db.get(InfrastructureObject, bottomhole_id)
        if bottomhole is None:
            raise HTTPException(status_code=404, detail="Целевой забой не найден")

        design = design_lateral_xyz(
            obj,
            well,
            body.kickoff_xyz or [],
            bottomhole,
            step_m=body.step_m,
            dls_design=body.dls_design,
            endpoint=endpoint,
        )
        xyz = design.xyz
        warnings.extend(design.warnings)

    if xyz is None or len(xyz) < 2:
        raise HTTPException(status_code=400, detail="Lateral требует минимум 2 точки XYZ")

    record = add_branch_to_tree(
        obj.properties,
        well_index=body.well_index,
        tree=body.tree.model_dump(mode="json"),
        xyz=xyz,
        name=body.name,
        color=body.color,
        radius_m=body.radius_m,
    )
    return JSONResponse(content=add_branch_response_json(record, warnings))


async def handle_coarsen(
    project_id: UUID,
    object_id: UUID,
    body: PyWellGeoCoarsenRequest,
    user: User,
    db: AsyncSession,
) -> PyWellGeoCoarsenResponse:
    obj = await read_pad_for_read(project_id, object_id, user, db)
    record, before, after = coarsen_tree(
        obj.properties,
        well_index=body.well_index,
        tree=body.tree.model_dump(mode="json"),
        segment_length_m=body.segment_length_m,
    )
    return PyWellGeoCoarsenResponse(tree=record, node_count_before=before, node_count_after=after)


async def handle_split_at_z(
    project_id: UUID,
    object_id: UUID,
    body: PyWellGeoSplitAtZRequest,
    user: User,
    db: AsyncSession,
) -> PyWellGeoSplitAtZResponse:
    obj = await read_pad_for_read(project_id, object_id, user, db)
    record = split_tree_at_z(
        obj.properties,
        well_index=body.well_index,
        tree=body.tree.model_dump(mode="json"),
        z_m=body.z_m,
    )
    return PyWellGeoSplitAtZResponse(tree=record)


async def handle_azim_dip(
    project_id: UUID,
    object_id: UUID,
    body: PyWellGeoAzimDipRequest,
    user: User,
    db: AsyncSession,
) -> PyWellGeoAzimDipResponse:
    await read_pad_for_read(project_id, object_id, user, db)
    result = await run_planner_async(
        run_pywellgeo,
        "azim_dip_convert",
        body.model_dump(mode="json"),
    )
    return PyWellGeoAzimDipResponse.model_validate(result)


async def handle_water_properties(
    project_id: UUID,
    object_id: UUID,
    body: PyWellGeoWaterPropertiesRequest,
    user: User,
    db: AsyncSession,
) -> PyWellGeoWaterPropertiesResponse:
    await read_pad_for_read(project_id, object_id, user, db)
    result = await run_planner_async(
        run_pywellgeo,
        "water_properties",
        body.model_dump(mode="json"),
    )
    return PyWellGeoWaterPropertiesResponse.model_validate(result)


async def handle_dc1d_build(
    project_id: UUID,
    object_id: UUID,
    body: PyWellGeoDc1dBuildRequest,
    user: User,
    db: AsyncSession,
) -> PyWellGeoTreeRecord:
    await read_pad_for_read(project_id, object_id, user, db)
    payload = body.model_dump(mode="json")
    well_index = payload.pop("well_index")
    result = await run_planner_async(run_pywellgeo, "dc1d_build", payload)
    wells = result.get("wells") or []
    if not wells:
        raise ValueError("DC1D build returned no wells")
    first = wells[0]
    return PyWellGeoTreeRecord(
        well_index=well_index,
        name=first.get("name"),
        tree=first["tree"],
        source="dc1d",
    )


async def handle_coordinate_transform(
    project_id: UUID,
    object_id: UUID,
    body: PyWellGeoCoordinateTransformRequest,
    user: User,
    db: AsyncSession,
) -> dict:
    await read_pad_for_read(project_id, object_id, user, db)
    return await run_planner_async(run_pywellgeo, "coordinate_transform", body.model_dump(mode="json"))
