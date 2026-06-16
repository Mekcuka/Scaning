"""Job calculation journal — steps + realtime events."""

import asyncio
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.core.database import async_session
from app.core.security import get_password_hash
from app.models import Project, ProjectJob, User
from app.models.enums import UserRole
from app.services.job_steps import (
    STEP_STATUS_OK,
    STEP_STATUS_RUNNING,
    append_job_step,
    get_step_counts,
    list_job_steps,
    update_job_step,
)
from app.services.project_jobs import (
    JOB_STATUS_PENDING,
    JOB_STATUS_RUNNING,
    JOB_TYPE_POI_ANALYZE_ALL,
    mark_job_running,
)


def test_append_and_list_job_steps():
    asyncio.run(_test_append_and_list_job_steps())


async def _test_append_and_list_job_steps():
    async with async_session() as db:
        user = User(
            email=f"steps-{uuid4().hex[:8]}@test.ru",
            username=f"steps_{uuid4().hex[:6]}",
            password_hash=get_password_hash("password1"),
            role=UserRole.analyst.value,
        )
        db.add(user)
        await db.flush()
        project = Project(user_id=user.id, name="Steps", status="draft")
        db.add(project)
        await db.flush()
        job = ProjectJob(
            project_id=project.id,
            user_id=user.id,
            job_type=JOB_TYPE_POI_ANALYZE_ALL,
            status=JOB_STATUS_PENDING,
            payload={},
        )
        db.add(job)
        await db.commit()

    step = await append_job_step(
        job.id,
        project.id,
        seq=1,
        step_code="fetch_pois",
        title="Загрузка точек интереса",
        status=STEP_STATUS_RUNNING,
    )
    assert step.seq == 1
    assert step.status == STEP_STATUS_RUNNING

    await update_job_step(step.id, status=STEP_STATUS_OK)

    async with async_session() as db:
        rows = await list_job_steps(db, job.id)
        total, completed = await get_step_counts(db, job.id)
    assert len(rows) == 1
    assert rows[0].status == STEP_STATUS_OK
    assert total == 1
    assert completed == 1


def test_mark_job_running_publishes_status(monkeypatch):
    asyncio.run(_test_mark_job_running_publishes_status(monkeypatch))


async def _test_mark_job_running_publishes_status(monkeypatch):
    published: list[dict] = []
    mock_publish = AsyncMock(side_effect=lambda _pid, event: published.append(event))
    monkeypatch.setattr("app.services.job_events.publish_job_event", mock_publish)

    async with async_session() as db:
        user = User(
            email=f"rt-{uuid4().hex[:8]}@test.ru",
            username=f"rt_{uuid4().hex[:6]}",
            password_hash=get_password_hash("password1"),
            role=UserRole.analyst.value,
        )
        db.add(user)
        await db.flush()
        project = Project(user_id=user.id, name="RT", status="draft")
        db.add(project)
        await db.flush()
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

        await mark_job_running(db, job)
        await db.commit()

    assert job.status == JOB_STATUS_RUNNING
    assert any(e.get("type") == "job.status_changed" for e in published)
    status_event = next(e for e in published if e.get("type") == "job.status_changed")
    assert status_event["previous_status"] == JOB_STATUS_PENDING
    assert status_event["status"] == JOB_STATUS_RUNNING
