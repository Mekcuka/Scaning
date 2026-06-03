"""Project background jobs."""

import asyncio
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError

from app.core.database import async_session
from app.core.security import get_password_hash
from app.models import Project, User
from app.models.enums import UserRole
from app.services.project_jobs import (
    JOB_TYPE_POI_ANALYZE_ALL,
    JOB_STATUS_PENDING,
    ActiveProjectJobError,
    create_project_job,
    get_active_job_for_project,
)


def test_create_second_job_raises_active_error():
    asyncio.run(_test_create_second_job_raises_active_error())


async def _test_create_second_job_raises_active_error():
    async with async_session() as db:
        user = User(
            email=f"jobs-{uuid4().hex[:8]}@test.ru",
            username="jobs_test",
            password_hash=get_password_hash("password1"),
            role=UserRole.analyst.value,
        )
        db.add(user)
        await db.flush()
        project = Project(user_id=user.id, name="Jobs", status="draft")
        db.add(project)
        await db.flush()

        await create_project_job(
            db,
            project_id=project.id,
            user_id=user.id,
            job_type=JOB_TYPE_POI_ANALYZE_ALL,
            payload={},
        )
        await db.commit()

        async with async_session() as db2:
            with pytest.raises(ActiveProjectJobError):
                await create_project_job(
                    db2,
                    project_id=project.id,
                    user_id=user.id,
                    job_type=JOB_TYPE_POI_ANALYZE_ALL,
                    payload={},
                )


def test_active_job_query():
    asyncio.run(_test_active_job_query())


async def _test_active_job_query():
    async with async_session() as db:
        user = User(
            email=f"jobs2-{uuid4().hex[:8]}@test.ru",
            username="jobs2",
            password_hash=get_password_hash("password1"),
            role=UserRole.analyst.value,
        )
        db.add(user)
        await db.flush()
        project = Project(user_id=user.id, name="Jobs2", status="draft")
        db.add(project)
        await db.flush()
        job = await create_project_job(
            db,
            project_id=project.id,
            user_id=user.id,
            job_type=JOB_TYPE_POI_ANALYZE_ALL,
            payload={},
        )
        await db.commit()
        assert job.status == JOB_STATUS_PENDING

        async with async_session() as db2:
            active = await get_active_job_for_project(db2, project.id)
            assert active is not None
            assert active.id == job.id
