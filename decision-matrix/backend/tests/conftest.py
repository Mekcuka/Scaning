"""Shared pytest fixtures."""

import asyncio
import os

import pytest
from starlette.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("DEMO_USERS_ENABLED", "false")
os.environ.setdefault("ENVIRONMENT", "test")

from app.core.database import async_session
from app.core.security import get_password_hash
from app.main import app
from app.models import User
from app.models.enums import UserRole


async def seed_role_users() -> None:
    from sqlalchemy import select

    async with async_session() as db:
        for email, role in (
            ("admin@test.ru", UserRole.admin),
            ("viewer@test.ru", UserRole.viewer),
            ("data@test.ru", UserRole.data_manager),
            ("analyst@test.ru", UserRole.analyst),
        ):
            existing = await db.scalar(select(User.id).where(User.email == email))
            if existing:
                continue
            db.add(
                User(
                    email=email,
                    username=role.value,
                    password_hash=get_password_hash("password1"),
                    role=role.value,
                )
            )
        await db.commit()


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        asyncio.run(seed_role_users())
        yield c


def register(client: TestClient, email: str, username: str, password: str = "password1"):
    return client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "username": username},
    )


def login(client: TestClient, email: str, password: str = "password1"):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def csrf_headers(client: TestClient) -> dict[str, str]:
    token = client.cookies.get("csrf_token")
    assert token
    return {"X-CSRF-Token": token}
