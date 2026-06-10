"""Session and platform status assistant tools."""

from __future__ import annotations

from pydantic import BaseModel

from app.assistant.chat.ports.llm_port import default_llm_client
from app.assistant.context import ToolContext
from app.assistant.registry import register_tool
from app.assistant.tools.base import ToolDefinition
from app.assistant.tools.categories import CAT_SESSION, cats
from app.core.config import settings
from app.schemas import UserResponse
from app.services.autoroad_network.planner_adapter import get_solver_status, get_solver_status_http


class EmptyInput(BaseModel):
    pass


async def _get_me(ctx: ToolContext, _args: EmptyInput) -> dict:
    return UserResponse.model_validate(ctx.user).model_dump(mode="json")


async def _get_assistant_status(ctx: ToolContext, _args: EmptyInput) -> dict:
    if not settings.ASSISTANT_CHAT_ENABLED:
        return {"enabled": False, "provider_ready": False}
    ready = await default_llm_client.probe_provider()
    model = settings.ASSISTANT_LLM_MODEL.strip() or None
    return {
        "enabled": True,
        "model": model,
        "provider_ready": ready,
        "base_url": settings.ASSISTANT_LLM_BASE_URL.rstrip("/") or None,
    }


async def _get_autoroad_solver_status(ctx: ToolContext, _args: EmptyInput) -> dict:
    if settings.AUTOROAD_NETWORK_INPROCESS:
        status = get_solver_status()
    else:
        status = await get_solver_status_http()
    return status.model_dump(mode="json")


def register() -> None:
    register_tool(
        ToolDefinition(
            name="get_me",
            description="Get the current authenticated user profile (role, email).",
            input_model=EmptyInput,
            handler=_get_me,
            categories=cats(CAT_SESSION),
        )
    )
    register_tool(
        ToolDefinition(
            name="get_assistant_status",
            description="Check whether assistant chat and LLM provider are available.",
            input_model=EmptyInput,
            handler=_get_assistant_status,
            categories=cats(CAT_SESSION),
        )
    )
    register_tool(
        ToolDefinition(
            name="get_autoroad_solver_status",
            description="Report SteinerPy / GeoSteiner solver availability for autoroad planning.",
            input_model=EmptyInput,
            handler=_get_autoroad_solver_status,
            categories=cats(CAT_SESSION),
        )
    )
