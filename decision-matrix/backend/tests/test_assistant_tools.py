"""Tests for assistant shared tool registry."""



from __future__ import annotations



import asyncio



import pytest

from sqlalchemy import select



from app.assistant import ToolContext, execute_tool, list_tools

from app.core.database import async_session

from app.models import Project, User

from tests.conftest import seed_role_users



MUTATING_TOOLS = frozenset(
    {
        "start_analyze_all_pois",
        "cancel_project_job",
        "create_project",
        "create_poi",
        "update_infra_object",
        "analyze_poi",
        "update_cost_rates",
        "batch_delete_map_objects",
    }
)

ADMIN_ONLY_TOOLS = frozenset(
    {
        "admin_list_jobs",
        "admin_jobs_health",
        "admin_list_users",
        "admin_stats",
        "admin_list_assistant_audit",
    }
)





async def _user_by_email(email: str) -> User:

    async with async_session() as db:

        user = await db.scalar(select(User).where(User.email == email))

        assert user is not None

        return user





async def _tool_names(email: str) -> set[str]:

    user = await _user_by_email(email)

    async with async_session() as db:

        ctx = ToolContext(user=user, db=db, env="test")

        return {t.name for t in list_tools(ctx)}





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





def test_list_tools_analyst_sees_expected_tools():

    names = asyncio.run(_tool_names("analyst@test.ru"))

    assert names.isdisjoint(ADMIN_ONLY_TOOLS)

    assert MUTATING_TOOLS.issubset(names)





def test_viewer_hides_mutating_tools():

    names = asyncio.run(_tool_names("viewer@test.ru"))

    assert names.isdisjoint(MUTATING_TOOLS)

    assert names.isdisjoint(ADMIN_ONLY_TOOLS)





def test_admin_sees_admin_tools():

    analyst = asyncio.run(_tool_names("analyst@test.ru"))

    viewer = asyncio.run(_tool_names("viewer@test.ru"))

    admin = asyncio.run(_tool_names("admin@test.ru"))

    assert ADMIN_ONLY_TOOLS.issubset(admin)

    assert len(viewer) == len(analyst) - len(MUTATING_TOOLS)

    assert len(admin) == len(analyst) + len(ADMIN_ONLY_TOOLS)





def test_get_me_smoke():

    async def _run():

        user = await _user_by_email("analyst@test.ru")

        async with async_session() as db:

            ctx = ToolContext(user=user, db=db, env="test")

            result = await execute_tool("get_me", {}, ctx)

        assert result.ok is True

        assert result.data["email"] == "analyst@test.ru"

        assert result.data["role"] == "analyst"



    asyncio.run(_run())





def test_list_infra_layers_smoke():

    async def _run():

        user, project = await _create_project_for_analyst("Layers Test Project")

        async with async_session() as db:

            ctx = ToolContext(user=user, db=db, env="test")

            result = await execute_tool("list_infra_layers", {"project_id": str(project.id)}, ctx)

        assert result.ok is True

        assert isinstance(result.data, list)



    asyncio.run(_run())





def test_get_cost_rates_smoke():

    async def _run():

        user, project = await _create_project_for_analyst("Rates Test Project")

        async with async_session() as db:

            ctx = ToolContext(user=user, db=db, env="test")

            result = await execute_tool("get_cost_rates", {"project_id": str(project.id)}, ctx)

        assert result.ok is True

        assert result.data["project_id"] == str(project.id)

        assert "rates" in result.data



    asyncio.run(_run())





def test_cancel_project_job_smoke():

    async def _run():

        from app.models import ProjectJob

        from app.services.project_jobs import JOB_STATUS_PENDING, JOB_TYPE_POI_ANALYZE_ALL



        user, project = await _create_project_for_analyst("Cancel Job Project")

        async with async_session() as db:

            job = ProjectJob(

                project_id=project.id,

                user_id=user.id,

                job_type=JOB_TYPE_POI_ANALYZE_ALL,

                status=JOB_STATUS_PENDING,

                payload={},

            )

            db.add(job)

            await db.commit()

            await db.refresh(job)

            job_id = job.id



            ctx = ToolContext(user=user, db=db, env="test")

            result = await execute_tool(

                "cancel_project_job",

                {"project_id": str(project.id), "job_id": str(job_id)},

                ctx,

            )

        assert result.ok is True

        assert result.data["status"] == "cancelled"



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


