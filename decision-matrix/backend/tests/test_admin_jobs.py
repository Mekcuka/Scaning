"""Admin background jobs API."""

import asyncio
import os
from uuid import uuid4

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

import pytest
from starlette.testclient import TestClient

from app.core.database import async_session
from app.core.security import get_password_hash
from app.main import app
from app.models import Project, User
from app.models.enums import UserRole
from app.services.admin_jobs import admin_cancel_job, list_jobs_admin
from app.services.project_jobs import (
    JOB_STATUS_CANCELLED,
    JOB_STATUS_COMPLETED,
    JOB_STATUS_PENDING,
    JOB_TYPE_POI_ANALYZE_ALL,
    create_project_job,
)


@pytest.fixture
def admin_http_client():
    admin_email = f"admin-jobs-{uuid4().hex[:8]}@test.ru"
    project_id_holder: list = []

    async def _seed():
        async with async_session() as db:
            admin = User(
                email=admin_email,
                username="admin_jobs",
                password_hash=get_password_hash("password1"),
                role=UserRole.admin.value,
            )
            db.add(admin)
            await db.flush()
            project = Project(user_id=admin.id, name="AdminJobsProj", status="draft")
            db.add(project)
            await db.flush()
            project_id_holder.append(project.id)
            await db.commit()

    asyncio.run(_seed())
    with TestClient(app) as client:
        login = client.post(
            "/api/v1/auth/login",
            json={"email": admin_email, "password": "password1"},
        )
        assert login.status_code == 200
        yield client, project_id_holder[0]


def test_admin_cancel_completed_is_idempotent():
    asyncio.run(_test_admin_cancel_completed_is_idempotent())


async def _test_admin_cancel_completed_is_idempotent():
    async with async_session() as db:
        user = User(
            email=f"cancel-idem-{uuid4().hex[:8]}@test.ru",
            username="cancel_idem",
            password_hash=get_password_hash("password1"),
            role=UserRole.admin.value,
        )
        db.add(user)
        await db.flush()
        project = Project(user_id=user.id, name="P", status="draft")
        db.add(project)
        await db.flush()
        job = await create_project_job(
            db,
            project_id=project.id,
            user_id=user.id,
            job_type=JOB_TYPE_POI_ANALYZE_ALL,
            payload={},
        )
        job.status = JOB_STATUS_COMPLETED
        await db.commit()

        async with async_session() as db2:
            out = await admin_cancel_job(db2, job.id)
            await db2.commit()
            assert out.status == JOB_STATUS_COMPLETED

        async with async_session() as db3:
            out = await admin_cancel_job(db3, job.id)
            assert out.status == JOB_STATUS_COMPLETED


def test_admin_cancel_pending_marks_cancelled():
    asyncio.run(_test_admin_cancel_pending_marks_cancelled())


async def _test_admin_cancel_pending_marks_cancelled():
    async with async_session() as db:
        user = User(
            email=f"cancel-pend-{uuid4().hex[:8]}@test.ru",
            username="cancel_pend",
            password_hash=get_password_hash("password1"),
            role=UserRole.admin.value,
        )
        db.add(user)
        await db.flush()
        project = Project(user_id=user.id, name="P2", status="draft")
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

        async with async_session() as db2:
            out = await admin_cancel_job(db2, job.id)
            await db2.commit()
            assert out.status == JOB_STATUS_CANCELLED


def test_list_jobs_admin_filter():
    asyncio.run(_test_list_jobs_admin_filter())


async def _test_list_jobs_admin_filter():
    async with async_session() as db:
        user = User(
            email=f"list-{uuid4().hex[:8]}@test.ru",
            username="list_jobs",
            password_hash=get_password_hash("password1"),
            role=UserRole.admin.value,
        )
        db.add(user)
        await db.flush()
        project = Project(user_id=user.id, name="ListProj", status="draft")
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
            rows, total = await list_jobs_admin(
                db2, statuses=[JOB_STATUS_PENDING], project_id=project.id
            )
            assert total >= 1
            assert all(r.job.status == JOB_STATUS_PENDING for r in rows)
            assert rows[0].project_name == "ListProj"


def test_admin_jobs_http_list_and_health(admin_http_client):
    client, project_id = admin_http_client
    health = client.get("/api/v1/admin/jobs/health")
    assert health.status_code == 200
    body = health.json()
    assert "jobs_by_status" in body
    assert "redis_ok" in body

    listed = client.get(
        "/api/v1/admin/jobs",
        params={"project_id": str(project_id), "limit": 10},
    )
    assert listed.status_code == 200
    data = listed.json()
    assert "items" in data
    assert data["total"] >= 0
