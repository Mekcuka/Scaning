"""Explicit project deletion (SQLite-safe, no ORM nullify on children)."""

from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    ImportConnection,
    InfrastructureEdge,
    InfrastructureLayer,
    InfrastructureNetwork,
    InfrastructureNode,
    InfrastructureObject,
    PointOfInterest,
    PoiInfrastructureAnalysis,
    Project,
    ProjectCostRates,
    ProjectDistanceDefaults,
    ProjectEconomicParams,
    ProjectSandLogisticsResult,
    OnePager,
)


async def delete_project_cascade(db: AsyncSession, project_id: UUID) -> bool:
    poi_ids = select(PointOfInterest.id).where(PointOfInterest.project_id == project_id)
    layer_ids = select(InfrastructureLayer.id).where(InfrastructureLayer.project_id == project_id)

    await db.execute(delete(PoiInfrastructureAnalysis).where(PoiInfrastructureAnalysis.poi_id.in_(poi_ids)))
    net_ids = select(InfrastructureNetwork.id).where(InfrastructureNetwork.project_id == project_id)
    await db.execute(delete(InfrastructureEdge).where(InfrastructureEdge.network_id.in_(net_ids)))
    await db.execute(delete(InfrastructureNode).where(InfrastructureNode.network_id.in_(net_ids)))
    await db.execute(delete(InfrastructureNetwork).where(InfrastructureNetwork.project_id == project_id))
    await db.execute(delete(InfrastructureObject).where(InfrastructureObject.layer_id.in_(layer_ids)))
    await db.execute(delete(PointOfInterest).where(PointOfInterest.project_id == project_id))
    await db.execute(delete(InfrastructureLayer).where(InfrastructureLayer.project_id == project_id))
    await db.execute(delete(OnePager).where(OnePager.project_id == project_id))
    await db.execute(delete(ImportConnection).where(ImportConnection.project_id == project_id))
    await db.execute(delete(ProjectCostRates).where(ProjectCostRates.project_id == project_id))
    await db.execute(delete(ProjectEconomicParams).where(ProjectEconomicParams.project_id == project_id))
    await db.execute(delete(ProjectDistanceDefaults).where(ProjectDistanceDefaults.project_id == project_id))
    await db.execute(
        delete(ProjectSandLogisticsResult).where(ProjectSandLogisticsResult.project_id == project_id)
    )

    result = await db.execute(delete(Project).where(Project.id == project_id))
    return result.rowcount > 0
