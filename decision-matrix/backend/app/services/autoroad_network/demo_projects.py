"""Idempotent demo projects showcasing autoroad network planner results."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.geo.geometry_utils import build_infra_geometry
from app.geo.validation import category_for_subtype
from app.models import (
    InfrastructureLayer,
    InfrastructureObject,
    Project,
    ProjectCostRates,
    ProjectDistanceDefaults,
    ProjectEconomicParams,
    User,
)
from app.services.autoroad_connect import run_autoroad_connect
from app.services.cost_rates import DEFAULT_COST_RATES
from app.services.economic_rates import DEFAULT_ECONOMIC_PARAMS
from app.services.graph_builder import build_network_from_lines

DEMO_PREFIX = "Демо автосеть:"


@dataclass(frozen=True)
class _InfraSpec:
    key: str
    name: str
    subtype: str
    lon: float
    lat: float
    end_lon: float | None = None
    end_lat: float | None = None


@dataclass(frozen=True)
class AutoroadNetworkDemoScenario:
    slug: str
    title: str
    description: str
    objects: tuple[_InfraSpec, ...]
    connect_keys: tuple[str, ...]

    @property
    def project_name(self) -> str:
        return f"{DEMO_PREFIX} {self.title}"


DEMO_SCENARIOS: tuple[AutoroadNetworkDemoScenario, ...] = (
    AutoroadNetworkDemoScenario(
        slug="off_network_two",
        title="2 объекта без дорог",
        description=(
            "Два куста без существующей сети: одна прямая autoroad между объектами "
            "(одна прямая autoroad между терминалами)."
        ),
        objects=(
            _InfraSpec("a", "Куст А", "oil_pad", 37.600, 55.750),
            _InfraSpec("b", "Куст Б", "gas_processing", 37.640, 55.760),
        ),
        connect_keys=("a", "b"),
    ),
    AutoroadNetworkDemoScenario(
        slug="off_network_three",
        title="3 объекта без дорог",
        description="Три объекта без дорог: MST с узлами на рёбрах, по одному подъезду на объект.",
        objects=(
            _InfraSpec("a", "Куст-1", "oil_pad", 37.600, 55.750),
            _InfraSpec("b", "Куст-2", "refinery", 37.620, 55.750),
            _InfraSpec("c", "Куст-3", "gas_processing", 37.640, 55.750),
        ),
        connect_keys=("a", "b", "c"),
    ),
    AutoroadNetworkDemoScenario(
        slug="spurs_on_road",
        title="Подъезды к дороге",
        description=(
            "Готовая магистраль и три объекта у дороги: только подъезды object→snap на полилинии, "
            "без прямых связей object↔object."
        ),
        objects=(
            _InfraSpec("road", "Магистраль", "autoroad", 37.600, 55.750, 37.640, 55.750),
            _InfraSpec("a", "ГКС Запад", "gas_processing", 37.600, 55.760),
            _InfraSpec("b", "Узел центр", "refinery", 37.620, 55.760),
            _InfraSpec("c", "Куст Восток", "oil_pad", 37.640, 55.760),
        ),
        connect_keys=("a", "b", "c"),
    ),
    AutoroadNetworkDemoScenario(
        slug="broken_network_bridge",
        title="Разрыв сети (мост)",
        description=(
            "Две несвязанные цепочки autoroad: подъезды к каждой дороге и новый участок "
            "между snap-точками на линиях (не через поле object↔object)."
        ),
        objects=(
            _InfraSpec("road_w", "Дорога запад", "autoroad", 37.600, 55.750, 37.610, 55.750),
            _InfraSpec("road_e", "Дорога восток", "autoroad", 37.630, 55.750, 37.640, 55.750),
            _InfraSpec("a", "Куст З", "oil_pad", 37.600, 55.760),
            _InfraSpec("b", "Куст В", "gas_processing", 37.640, 55.760),
        ),
        connect_keys=("a", "b"),
    ),
    AutoroadNetworkDemoScenario(
        slug="far_from_road",
        title="Далеко от дороги",
        description=(
            "Объект существенно севернее полилинии (>300 m): длинный подъезд к ближайшей точке "
            "на дороге; второй объект — обычный короткий подъезд."
        ),
        objects=(
            _InfraSpec("road", "Магистраль", "autoroad", 37.600, 55.750, 37.640, 55.750),
            _InfraSpec("far", "ДНС север", "refinery", 37.620, 55.800),
            _InfraSpec("near", "Куст юг", "oil_pad", 37.640, 55.760),
        ),
        connect_keys=("far", "near"),
    ),
    AutoroadNetworkDemoScenario(
        slug="already_connected",
        title="Уже на дороге",
        description=(
            "Один объект на конце существующей autoroad (уже подключён), второй — с подъездом. "
            "Повторный «Сеть» для первого не создаёт второй подъезд."
        ),
        objects=(
            _InfraSpec("road", "Магистраль", "autoroad", 37.600, 55.750, 37.640, 55.750),
            _InfraSpec("on_road", "Узел на дороге", "gas_processing", 37.600, 55.750),
            _InfraSpec("off_road", "Куст в стороне", "oil_pad", 37.640, 55.760),
        ),
        connect_keys=("on_road", "off_road"),
    ),
)


async def _project_shell(db: AsyncSession, user_id: UUID, scenario: AutoroadNetworkDemoScenario) -> Project:
    project = Project(
        user_id=user_id,
        name=scenario.project_name,
        description=scenario.description,
        status="active",
        visibility="published",
    )
    db.add(project)
    await db.flush()
    db.add(ProjectCostRates(project_id=project.id, rates=dict(DEFAULT_COST_RATES)))
    db.add(ProjectEconomicParams(project_id=project.id, params=dict(DEFAULT_ECONOMIC_PARAMS)))
    db.add(ProjectDistanceDefaults(project_id=project.id))
    return project


async def _add_objects(
    db: AsyncSession,
    project_id: UUID,
    specs: tuple[_InfraSpec, ...],
) -> dict[str, UUID]:
    layer = InfrastructureLayer(
        project_id=project_id,
        name="Инфраструктура",
        layer_type="vector",
        source_type="manual",
    )
    db.add(layer)
    await db.flush()

    ids: dict[str, UUID] = {}
    for spec in specs:
        if spec.end_lon is not None and spec.end_lat is not None:
            geom = build_infra_geometry(
                spec.subtype, spec.lon, spec.lat, end_lon=spec.end_lon, end_lat=spec.end_lat
            )
        else:
            geom = build_infra_geometry(spec.subtype, spec.lon, spec.lat)
        obj = InfrastructureObject(
            layer_id=layer.id,
            name=spec.name,
            subtype=spec.subtype,
            category=category_for_subtype(spec.subtype),
            geometry=geom,
            longitude=spec.lon,
            latitude=spec.lat,
            end_longitude=spec.end_lon,
            end_latitude=spec.end_lat,
        )
        db.add(obj)
        await db.flush()
        ids[spec.key] = obj.id
    await build_network_from_lines(db, project_id)
    return ids


async def ensure_autoroad_network_demo_projects(
    db: AsyncSession,
    *,
    owner_email: str = "engineer@oilgas.ru",
) -> list[str]:
    """Create missing demo projects. Returns titles of newly created projects."""
    user = await db.scalar(select(User).where(User.email == owner_email))
    if not user:
        raise RuntimeError(f"Demo user not found: {owner_email}. Run seed.py first.")

    created: list[str] = []
    for scenario in DEMO_SCENARIOS:
        existing = await db.scalar(
            select(Project).where(
                Project.user_id == user.id,
                Project.name == scenario.project_name,
            )
        )
        if existing:
            continue

        project = await _project_shell(db, user.id, scenario)
        ids = await _add_objects(db, project.id, scenario.objects)
        connect_ids = [ids[k] for k in scenario.connect_keys]
        await run_autoroad_connect(db, project.id, connect_ids, dry_run=False)
        await db.flush()
        created.append(scenario.title)

    if created:
        await db.commit()
    return created
