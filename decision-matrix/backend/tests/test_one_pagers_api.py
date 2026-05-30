"""One-pager CRUD API integration tests."""

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


async def _seed_analyst() -> None:
    from sqlalchemy import select

    async with async_session() as db:
        existing = await db.scalar(select(User.id).where(User.email == "analyst-op@test.ru"))
        if existing:
            return
        db.add(
            User(
                email="analyst-op@test.ru",
                username="analyst_op",
                password_hash=get_password_hash("password1"),
                role=UserRole.analyst.value,
            )
        )
        await db.commit()


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        asyncio.run(_seed_analyst())
        yield c


def _login(client: TestClient) -> dict[str, str]:
    res = client.post("/api/v1/auth/login", json={"email": "analyst-op@test.ru", "password": "password1"})
    assert res.status_code == 200
    token = client.cookies.get("csrf_token")
    assert token
    return {"X-CSRF-Token": token}


def test_one_pager_crud(client: TestClient):
    headers = _login(client)
    project = client.post("/api/v1/projects", json={"name": "One-pager test"}, headers=headers).json()
    pid = project["id"]

    poi = client.post(
        f"/api/v1/projects/{pid}/pois",
        json={
            "name": "POI-1",
            "lon": 37.6,
            "lat": 55.75,
            "planned_production_volume": 100,
            "production_per_well": 10,
            "wells_per_pad": 4,
            "fluid_type": "oil",
        },
        headers=headers,
    ).json()
    client.post(f"/api/v1/projects/{pid}/pois/{poi['id']}/analyze", headers=headers)

    created = client.post(
        f"/api/v1/projects/{pid}/one-pagers",
        json={"poi_id": poi["id"]},
        headers=headers,
    )
    assert created.status_code == 201
    op = created.json()
    assert op["poi_id"] == poi["id"]
    assert op["title"]

    listed = client.get(f"/api/v1/projects/{pid}/one-pagers")
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    updated = client.put(
        f"/api/v1/projects/{pid}/one-pagers/{op['id']}",
        json={"recommendation_text": "Тестовая рекомендация"},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["recommendation_text"] == "Тестовая рекомендация"
    assert updated.json()["is_recommendation_edited"] is True

    deleted = client.delete(f"/api/v1/projects/{pid}/one-pagers/{op['id']}", headers=headers)
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/projects/{pid}/one-pagers").json() == []
