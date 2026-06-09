"""Tests for assistant shared tool registry."""

from __future__ import annotations

import asyncio

import pytest
from sqlalchemy import select

from app.assistant import ToolContext, execute_tool, list_tools
from app.core.database import async_session
from app.models import Project, User
from app.models.enums import UserRole
from tests.conftest import seed_role_users


async def _user_by_email(email: str) -> User:
    async with async_session() as db:
        user = await db.scalar(select(User).where(User.email == email))
        assert user is not None
        return user


async def _create_project_for_analyst(name: str = "Assistant Test Project") -> tuple[User, Project]:
    async with async_session() as db:
        user = await db.scalar(select(User).where(User.email == "analyst@test.ru"))
        assert user is not None
        project = Project(user_id=user.id, name=name, status="draft", visibility="private")
        db.add(project)
        await db.commit()
        await db.refresh(project)
        return user, project


@pytest.fixture(scope="module", autouse=True)
def _seed_users():
    asyncio.run(seed_role_users())


def test_list_tools_analyst_sees_ten_tools():
    async def _run():
        user = await _user_by_email("analyst@test.ru")
        async with async_session() as db:
            ctx = ToolContext(user=user, db=db, env="test")
            names = {t.name for t in list_tools(ctx)}
        assert names == {
            "get_flow_schematic",
            "get_poi_analysis",
            "get_project",
            "get_project_job",
            "get_sand_logistics_result",
            "list_infra_objects",
            "list_pois",
            "list_project_jobs",
            "list_projects",
            "start_analyze_all_pois",
        }

    asyncio.run(_run())


def test_viewer_hides_mutating_tool():
    async def _run():
        user = await _user_by_email("viewer@test.ru")
        async with async_session() as db:
            ctx = ToolContext(user=user, db=db, env="test")
            names = {t.name for t in list_tools(ctx)}
        assert "start_analyze_all_pois" not in names
        assert len(names) == 9

    asyncio.run(_run())


def test_list_projects_and_get_project_smoke():
    async def _run():
        user, project = await _create_project_for_analyst()
        async with async_session() as db:
            ctx = ToolContext(user=user, db=db, env="test")
            listed = await execute_tool("list_projects", {}, ctx)
            assert listed.ok is True
            ids = {p["id"] for p in listed.data}
            assert str(project.id) in ids

            got = await execute_tool("get_project", {"project_id": str(project.id)}, ctx)
            assert got.ok is True
            assert got.data["name"] == "Assistant Test Project"
            assert got.data["id"] == str(project.id)

    asyncio.run(_run())


def test_get_project_not_found():
    async def _run():
        user = await _user_by_email("analyst@test.ru")
        async with async_session() as db:
            ctx = ToolContext(user=user, db=db, env="test")
            result = await execute_tool(
                "get_project",
                {"project_id": "00000000-0000-0000-0000-000000000099"},
                ctx,
            )
        assert result.ok is False
        assert result.code == "not_found"

    asyncio.run(_run())
