"""Project setup: create with default rates, economic params, distance defaults."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Project, ProjectCostRates, ProjectDistanceDefaults, ProjectEconomicParams, User
from app.services.cost_rates import DEFAULT_COST_RATES
from app.services.economic_rates import DEFAULT_ECONOMIC_PARAMS


async def create_project_with_defaults(
    db: AsyncSession,
    *,
    user: User,
    name: str,
    description: str | None,
) -> Project:
    project = Project(user_id=user.id, name=name, description=description, status="draft")
    db.add(project)
    await db.flush()
    db.add(ProjectCostRates(project_id=project.id, rates=dict(DEFAULT_COST_RATES)))
    db.add(ProjectEconomicParams(project_id=project.id, params=dict(DEFAULT_ECONOMIC_PARAMS)))
    db.add(ProjectDistanceDefaults(project_id=project.id))
    await db.commit()
    await db.refresh(project)
    return project
