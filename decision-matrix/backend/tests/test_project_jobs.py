"""Project background jobs."""

import asyncio
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.core.database import async_session
from app.core.security import get_password_hash
from app.models import Project, ProjectJob, User
from app.models.enums import UserRole
from app.services.project_jobs import (
    JOB_TYPE_POI_ANALYZE_ALL,
    JOB_STATUS_FAILED,
    JOB_STATUS_PENDING,
    JOB_STATUS_COMPLETED,
    ActiveProjectJobError,
    create_project_job,
    expire_stale_job_if_needed,
    get_active_job_for_project,
    is_job_stale,
    list_recent_jobs,
    mark_job_completed,
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


def test_stale_pending_job_allows_new_create():
    asyncio.run(_test_stale_pending_job_allows_new_create())


async def _test_stale_pending_job_allows_new_create():
    async with async_session() as db:
        user = User(
            email=f"jobs-stale-{uuid4().hex[:8]}@test.ru",
            username="jobs_stale",
            password_hash=get_password_hash("password1"),
            role=UserRole.analyst.value,
        )
        db.add(user)
        await db.flush()
        project = Project(user_id=user.id, name="JobsStale", status="draft")
        db.add(project)
        await db.flush()

        old = await create_project_job(
            db,
            project_id=project.id,
            user_id=user.id,
            job_type=JOB_TYPE_POI_ANALYZE_ALL,
            payload={},
        )
        old.created_at = datetime.now(timezone.utc) - timedelta(
            seconds=settings.JOB_STALE_PENDING_SECONDS + 60
        )
        await db.commit()

        async with async_session() as db2:
            job2 = await create_project_job(
                db2,
                project_id=project.id,
                user_id=user.id,
                job_type=JOB_TYPE_POI_ANALYZE_ALL,
                payload={"retry": True},
            )
            await db2.commit()
            assert job2.id != old.id

        async with async_session() as db3:
            expired = await db3.get(ProjectJob, old.id)
            assert expired.status == JOB_STATUS_FAILED
            assert await get_active_job_for_project(db3, project.id) is not None
            assert (await get_active_job_for_project(db3, project.id)).id == job2.id


def test_is_job_stale_pending():
    now = datetime(2025, 6, 1, 12, 0, tzinfo=timezone.utc)
    job = ProjectJob(
        project_id=uuid4(),
        user_id=uuid4(),
        job_type=JOB_TYPE_POI_ANALYZE_ALL,
        status=JOB_STATUS_PENDING,
    )
    job.created_at = now - timedelta(seconds=settings.JOB_STALE_PENDING_SECONDS + 1)
    assert is_job_stale(job, now=now)
    job.created_at = now - timedelta(seconds=30)
    assert not is_job_stale(job, now=now)


def test_expire_stale_job_if_needed():
    asyncio.run(_test_expire_stale_job_if_needed())


def test_list_recent_jobs():
    asyncio.run(_test_list_recent_jobs())


async def _test_list_recent_jobs():
    async with async_session() as db:
        user = User(
            email=f"jobs-list-{uuid4().hex[:8]}@test.ru",
            username="jobs_list",
            password_hash=get_password_hash("password1"),
            role=UserRole.analyst.value,
        )
        db.add(user)
        await db.flush()
        project = Project(user_id=user.id, name="JobsList", status="draft")
        db.add(project)
        await db.flush()

        j1 = await create_project_job(
            db,
            project_id=project.id,
            user_id=user.id,
            job_type=JOB_TYPE_POI_ANALYZE_ALL,
            payload={"n": 1},
        )
        await mark_job_completed(db, j1, {"ok": True})
        j2 = await create_project_job(
            db,
            project_id=project.id,
            user_id=user.id,
            job_type=JOB_TYPE_POI_ANALYZE_ALL,
            payload={"n": 2},
        )
        await db.commit()

        async with async_session() as db2:
            rows, total = await list_recent_jobs(db2, project.id, limit=30)
            assert total >= 2
            assert len(rows) >= 2
            assert rows[0].id == j2.id
            assert rows[1].id == j1.id
            assert rows[0].status == JOB_STATUS_PENDING
            assert rows[1].status == JOB_STATUS_COMPLETED


async def _test_expire_stale_job_if_needed():
    async with async_session() as db:
        user = User(
            email=f"jobs-exp-{uuid4().hex[:8]}@test.ru",
            username="jobs_exp",
            password_hash=get_password_hash("password1"),
            role=UserRole.analyst.value,
        )
        db.add(user)
        await db.flush()
        project = Project(user_id=user.id, name="JobsExp", status="draft")
        db.add(project)
        await db.flush()
        job = await create_project_job(
            db,
            project_id=project.id,
            user_id=user.id,
            job_type=JOB_TYPE_POI_ANALYZE_ALL,
            payload={},
        )
        job.created_at = datetime.now(timezone.utc) - timedelta(
            seconds=settings.JOB_STALE_PENDING_SECONDS + 120
        )
        assert await expire_stale_job_if_needed(db, job)
        assert job.status == JOB_STATUS_FAILED
