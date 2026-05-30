"""Auth, CSRF, and RBAC integration tests."""

import asyncio
import os

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"

import pytest
from starlette.testclient import TestClient

from app.core.database import async_session
from app.core.security import get_password_hash
from app.main import app
from app.models import User
from app.models.enums import UserRole


async def _seed_role_users() -> None:
    from sqlalchemy import select

    async with async_session() as db:
        for email, role in (
            ("admin@test.ru", UserRole.admin),
            ("viewer@test.ru", UserRole.viewer),
            ("data@test.ru", UserRole.data_manager),
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
        asyncio.run(_seed_role_users())
        yield c


def _register(client: TestClient, email: str, username: str, password: str = "password1"):
    return client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "username": username},
    )


def _login(client: TestClient, email: str, password: str = "password1"):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def _csrf_headers(client: TestClient) -> dict[str, str]:
    token = client.cookies.get("csrf_token")
    assert token
    return {"X-CSRF-Token": token}


def test_register_login_sets_cookies(client: TestClient):
    res = _register(client, "analyst@test.ru", "Analyst User")
    assert res.status_code == 201
    assert client.cookies.get("access_token")
    assert client.cookies.get("refresh_token")
    assert client.cookies.get("csrf_token")
    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["role"] == "analyst"


def test_csrf_blocks_mutating_without_header(client: TestClient):
    _register(client, "csrf@test.ru", "CSRF User")
    res = client.post("/api/v1/projects", json={"name": "No CSRF"})
    assert res.status_code == 403


def test_csrf_allows_with_header(client: TestClient):
    _register(client, "csrf2@test.ru", "CSRF User 2")
    res = client.post(
        "/api/v1/projects",
        json={"name": "With CSRF"},
        headers=_csrf_headers(client),
    )
    assert res.status_code == 201


def test_refresh_and_logout(client: TestClient):
    _register(client, "sess@test.ru", "Session User")
    refresh = client.post("/api/v1/auth/refresh", headers=_csrf_headers(client))
    assert refresh.status_code == 200
    logout = client.post("/api/v1/auth/logout", headers=_csrf_headers(client))
    assert logout.status_code == 200
    me = client.get("/api/v1/auth/me")
    assert me.status_code == 401


def test_viewer_read_only_on_published_project(client: TestClient):
    _register(client, "owner@test.ru", "Owner")
    headers = _csrf_headers(client)
    project = client.post("/api/v1/projects", json={"name": "Published"}, headers=headers).json()
    client.patch(
        f"/api/v1/projects/{project['id']}",
        json={"visibility": "published"},
        headers=headers,
    )

    client.post("/api/v1/auth/logout", headers=headers)
    _login(client, "viewer@test.ru")
    listed = client.get("/api/v1/projects")
    assert listed.status_code == 200
    assert project["id"] in [p["id"] for p in listed.json()]

    create = client.post("/api/v1/projects", json={"name": "Denied"}, headers=_csrf_headers(client))
    assert create.status_code == 403


def test_admin_lists_users(client: TestClient):
    client.post("/api/v1/auth/logout", headers=_csrf_headers(client) if client.cookies.get("csrf_token") else {})
    _login(client, "admin@test.ru")
    res = client.get("/api/v1/admin/users")
    assert res.status_code == 200
    assert len(res.json()) >= 1


def test_password_policy(client: TestClient):
    res = client.post(
        "/api/v1/auth/register",
        json={"email": "weak@test.ru", "password": "short", "username": "Weak"},
    )
    assert res.status_code == 422
