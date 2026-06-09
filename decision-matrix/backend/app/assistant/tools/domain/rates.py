"""Cost and economic parameter assistant tools."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field
from sqlalchemy import select

from app.assistant.context import ToolContext
from app.assistant.registry import register_tool
from app.assistant.tools.base import ToolDefinition
from app.assistant.tools.categories import CAT_RATES, cats
from app.models import ProjectCostRates, ProjectEconomicParams
from app.models.enums import AccessLevel, WriteScope
from app.schemas import CostRatesResponse, EconomicParamsResponse
from app.services.cost_rates import DEFAULT_COST_RATES, merge_project_cost_rates
from app.services.economic_rates import DEFAULT_ECONOMIC_PARAMS
from app.services.project_access import resolve_project


class ProjectIdInput(BaseModel):
    project_id: UUID


class UpdateCostRatesInput(BaseModel):
    project_id: UUID
    rates: dict[str, float] = Field(min_length=1)


async def _get_cost_rates(ctx: ToolContext, args: ProjectIdInput) -> dict:
    await resolve_project(
        args.project_id, ctx.user, ctx.db, min_access=AccessLevel.read, write_scope=WriteScope.project
    )
    result = await ctx.db.execute(
        select(ProjectCostRates).where(ProjectCostRates.project_id == args.project_id)
    )
    rates_row = result.scalar_one_or_none()
    rates = merge_project_cost_rates(rates_row.rates if rates_row else None)
    return CostRatesResponse(project_id=args.project_id, rates=rates).model_dump(mode="json")


async def _update_cost_rates(ctx: ToolContext, args: UpdateCostRatesInput) -> dict:
    await resolve_project(
        args.project_id, ctx.user, ctx.db, min_access=AccessLevel.write, write_scope=WriteScope.project
    )
    result = await ctx.db.execute(
        select(ProjectCostRates).where(ProjectCostRates.project_id == args.project_id)
    )
    rates_row = result.scalar_one_or_none()
    if not rates_row:
        rates_row = ProjectCostRates(project_id=args.project_id, rates=args.rates)
        ctx.db.add(rates_row)
    else:
        rates_row.rates = {**DEFAULT_COST_RATES, **rates_row.rates, **args.rates}
    await ctx.db.commit()
    await ctx.db.refresh(rates_row)
    return CostRatesResponse(project_id=args.project_id, rates=merge_project_cost_rates(rates_row.rates)).model_dump(
        mode="json"
    )


async def _get_economic_params(ctx: ToolContext, args: ProjectIdInput) -> dict:
    await resolve_project(
        args.project_id, ctx.user, ctx.db, min_access=AccessLevel.read, write_scope=WriteScope.project
    )
    result = await ctx.db.execute(
        select(ProjectEconomicParams).where(ProjectEconomicParams.project_id == args.project_id)
    )
    row = result.scalar_one_or_none()
    params = {**DEFAULT_ECONOMIC_PARAMS, **(row.params if row else {})}
    return EconomicParamsResponse(project_id=args.project_id, params=params).model_dump(mode="json")


def register() -> None:
    register_tool(
        ToolDefinition(
            name="get_cost_rates",
            description="Get project cost rates (tariffs) by project_id.",
            input_model=ProjectIdInput,
            handler=_get_cost_rates,
            categories=cats(CAT_RATES),
        )
    )
    register_tool(
        ToolDefinition(
            name="update_cost_rates",
            description="Update project cost rates (partial merge with existing tariffs).",
            input_model=UpdateCostRatesInput,
            handler=_update_cost_rates,
            mutating=True,
            categories=cats(CAT_RATES),
        )
    )
    register_tool(
        ToolDefinition(
            name="get_economic_params",
            description="Get project economic parameters by project_id.",
            input_model=ProjectIdInput,
            handler=_get_economic_params,
            categories=cats(CAT_RATES),
        )
    )
