import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.geo.columns import geometry_any_column, geometry_point_column


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    username: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(50), default="analyst")
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    projects: Mapped[list["Project"]] = relationship(back_populates="owner")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="draft")
    visibility: Mapped[str] = mapped_column(String(50), default="private")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner: Mapped["User"] = relationship(back_populates="projects")
    cost_rates: Mapped["ProjectCostRates | None"] = relationship(
        back_populates="project", uselist=False, cascade="all, delete-orphan"
    )
    distance_defaults: Mapped["ProjectDistanceDefaults | None"] = relationship(
        back_populates="project", uselist=False, cascade="all, delete-orphan"
    )
    import_connections: Mapped[list["ImportConnection"]] = relationship(
        cascade="all, delete-orphan", passive_deletes=True
    )
    pois: Mapped[list["PointOfInterest"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    infrastructure_layers: Mapped[list["InfrastructureLayer"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    scenarios: Mapped[list["Scenario"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    ranking_settings: Mapped[list["ProjectRankingSettings"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class ProjectCostRates(Base):
    __tablename__ = "project_cost_rates"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("projects.id", ondelete="CASCADE"), unique=True)
    rates: Mapped[dict] = mapped_column(JSON, default=dict)

    project: Mapped["Project"] = relationship(back_populates="cost_rates")


class ProjectDistanceDefaults(Base):
    __tablename__ = "project_distance_defaults"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("projects.id", ondelete="CASCADE"), unique=True)
    threshold_gas_processing_km: Mapped[float] = mapped_column(Float, default=80.0)
    threshold_gtes_km: Mapped[float] = mapped_column(Float, default=60.0)
    threshold_substation_km: Mapped[float] = mapped_column(Float, default=25.0)
    threshold_refinery_km: Mapped[float] = mapped_column(Float, default=100.0)
    max_total_line_autoroad_km: Mapped[float] = mapped_column(Float, default=50.0)
    max_total_line_oil_pipeline_km: Mapped[float] = mapped_column(Float, default=40.0)
    max_total_line_gas_pipeline_km: Mapped[float] = mapped_column(Float, default=40.0)
    max_total_line_water_pipeline_km: Mapped[float] = mapped_column(Float, default=30.0)
    max_total_line_power_line_km: Mapped[float] = mapped_column(Float, default=30.0)
    km_per_pad_autoroad: Mapped[float] = mapped_column(Float, default=3.0)
    km_per_pad_oil_pipeline: Mapped[float] = mapped_column(Float, default=3.0)
    km_per_pad_gas_pipeline: Mapped[float] = mapped_column(Float, default=3.0)
    km_per_pad_water_pipeline: Mapped[float] = mapped_column(Float, default=3.0)
    km_per_pad_power_line: Mapped[float] = mapped_column(Float, default=3.0)

    project: Mapped["Project"] = relationship(back_populates="distance_defaults")


class PointOfInterest(Base):
    __tablename__ = "points_of_interest"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("projects.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    geometry: Mapped[str | object] = geometry_point_column(nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    planned_production_volume: Mapped[float] = mapped_column(Float, default=0)
    production_per_well: Mapped[float] = mapped_column(Float, default=10.0)
    wells_per_pad: Mapped[int] = mapped_column(Integer, default=4)
    fluid_type: Mapped[str] = mapped_column(String(20), default="oil")
    water_injection_volume: Mapped[float] = mapped_column(Float, default=0)
    eng_power: Mapped[str] = mapped_column(String(30), default="external")
    eng_injection: Mapped[str] = mapped_column(String(30), default="centralized")
    eng_gas: Mapped[str] = mapped_column(String(30), default="well")
    eng_oil_preparation: Mapped[str] = mapped_column(String(30), default="mkos")
    eng_well_gathering: Mapped[str] = mapped_column(String(30), default="single_tube")
    eng_transport: Mapped[str] = mapped_column(String(30), default="auto")
    threshold_gas_processing_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    threshold_gtes_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    threshold_substation_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    threshold_refinery_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_total_line_autoroad_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_total_line_oil_pipeline_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_total_line_gas_pipeline_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_total_line_water_pipeline_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_total_line_power_line_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    km_per_pad_autoroad: Mapped[float | None] = mapped_column(Float, nullable=True)
    km_per_pad_oil_pipeline: Mapped[float | None] = mapped_column(Float, nullable=True)
    km_per_pad_gas_pipeline: Mapped[float | None] = mapped_column(Float, nullable=True)
    km_per_pad_water_pipeline: Mapped[float | None] = mapped_column(Float, nullable=True)
    km_per_pad_power_line: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    project: Mapped["Project"] = relationship(back_populates="pois")
    analysis_rows: Mapped[list["PoiInfrastructureAnalysis"]] = relationship(
        back_populates="poi", cascade="all, delete-orphan"
    )
    ranking_settings: Mapped[list["ProjectRankingSettings"]] = relationship(
        back_populates="poi", cascade="all, delete-orphan"
    )


class InfrastructureLayer(Base):
    __tablename__ = "infrastructure_layers"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("projects.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    layer_type: Mapped[str] = mapped_column(String(50), default="vector")
    source_type: Mapped[str] = mapped_column(String(50), default="manual")
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    opacity: Mapped[float] = mapped_column(Float, default=1.0)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    style_config: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    project: Mapped["Project"] = relationship(back_populates="infrastructure_layers")
    objects: Mapped[list["InfrastructureObject"]] = relationship(
        back_populates="layer", cascade="all, delete-orphan"
    )


class InfrastructureObject(Base):
    __tablename__ = "infrastructure_objects"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    layer_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("infrastructure_layers.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    subtype: Mapped[str] = mapped_column(String(50))
    geometry: Mapped[str | object] = geometry_any_column(nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    end_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    end_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    properties: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    layer: Mapped["InfrastructureLayer"] = relationship(back_populates="objects")


class PoiInfrastructureAnalysis(Base):
    __tablename__ = "poi_infrastructure_analysis"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    poi_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("points_of_interest.id", ondelete="CASCADE"))
    param_type: Mapped[str] = mapped_column(String(32), default="external")
    subtype: Mapped[str] = mapped_column(String(50))
    nearest_object_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("infrastructure_objects.id", ondelete="SET NULL"), nullable=True
    )
    distance_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    distance_source: Mapped[str] = mapped_column(String(30), default="geodesic")
    distance_method: Mapped[str] = mapped_column(String(20), default="geodesic")
    anchor_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    anchor_geometry: Mapped[str | object | None] = geometry_point_column(nullable=True)
    distance_status: Mapped[str] = mapped_column(String(32))
    max_allowed_distance_km: Mapped[float] = mapped_column(Float)
    is_manually_overridden: Mapped[bool] = mapped_column(Boolean, default=False)
    force_construction: Mapped[bool] = mapped_column(Boolean, default=False)
    overridden_object_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("infrastructure_objects.id", ondelete="SET NULL"), nullable=True
    )
    nearest_node_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("infrastructure_nodes.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    poi: Mapped["PointOfInterest"] = relationship(back_populates="analysis_rows")


class Scenario(Base):
    __tablename__ = "scenarios"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("projects.id", ondelete="CASCADE"))
    poi_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("points_of_interest.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255))
    scenario_type: Mapped[str] = mapped_column(String(50), default="base")
    is_manual: Mapped[bool] = mapped_column(Boolean, default=False)
    engineering_overrides: Mapped[dict] = mapped_column(JSON, default=dict)
    cost_overrides: Mapped[dict] = mapped_column(JSON, default=dict)
    results: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project: Mapped["Project"] = relationship(back_populates="scenarios")
    criterion_values: Mapped[list["ScenarioCriterionValue"]] = relationship(
        back_populates="scenario", cascade="all, delete-orphan"
    )


class ProjectRankingSettings(Base):
    __tablename__ = "project_ranking_settings"
    __table_args__ = (UniqueConstraint("project_id", "poi_id", name="uq_project_ranking_project_poi"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("projects.id", ondelete="CASCADE"))
    poi_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("points_of_interest.id", ondelete="CASCADE"))
    algorithm: Mapped[str] = mapped_column(String(20), default="topsis")
    criteria: Mapped[list[dict]] = mapped_column(JSON, default=list)
    weights: Mapped[dict[str, float]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    project: Mapped["Project"] = relationship(back_populates="ranking_settings")
    poi: Mapped["PointOfInterest"] = relationship(back_populates="ranking_settings")
    criterion_values: Mapped[list["ScenarioCriterionValue"]] = relationship(
        back_populates="ranking_settings", cascade="all, delete-orphan"
    )


class ScenarioCriterionValue(Base):
    __tablename__ = "scenario_criterion_values"
    __table_args__ = (
        UniqueConstraint("ranking_settings_id", "scenario_id", "criterion_id", name="uq_scenario_criterion_value"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    ranking_settings_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("project_ranking_settings.id", ondelete="CASCADE")
    )
    scenario_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("scenarios.id", ondelete="CASCADE"))
    criterion_id: Mapped[str] = mapped_column(String(100))
    value: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    ranking_settings: Mapped["ProjectRankingSettings"] = relationship(back_populates="criterion_values")
    scenario: Mapped["Scenario"] = relationship(back_populates="criterion_values")


class ImportLog(Base):
    __tablename__ = "import_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"))
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True
    )
    source_type: Mapped[str] = mapped_column(String(50))
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    records_total: Mapped[int] = mapped_column(Integer, default=0)
    records_imported: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ImportConnection(Base):
    __tablename__ = "import_connections"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"))
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("projects.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    api_url: Mapped[str] = mapped_column(Text)
    auth_type: Mapped[str] = mapped_column(String(50), default="bearer")
    credentials_encrypted: Mapped[str] = mapped_column(Text, default="")
    registry_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class InfrastructureNetwork(Base):
    __tablename__ = "infrastructure_networks"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("projects.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255), default="Сеть")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    nodes: Mapped[list["InfrastructureNode"]] = relationship(back_populates="network", cascade="all, delete-orphan")
    edges: Mapped[list["InfrastructureEdge"]] = relationship(back_populates="network", cascade="all, delete-orphan")


class InfrastructureNode(Base):
    __tablename__ = "infrastructure_nodes"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    network_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("infrastructure_networks.id", ondelete="CASCADE"))
    infrastructure_object_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("infrastructure_objects.id", ondelete="SET NULL"), nullable=True
    )
    longitude: Mapped[float] = mapped_column(Float)
    latitude: Mapped[float] = mapped_column(Float)
    geometry = geometry_point_column()

    network: Mapped["InfrastructureNetwork"] = relationship(back_populates="nodes")


class InfrastructureEdge(Base):
    __tablename__ = "infrastructure_edges"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    network_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("infrastructure_networks.id", ondelete="CASCADE"))
    from_node_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("infrastructure_nodes.id", ondelete="CASCADE"))
    to_node_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("infrastructure_nodes.id", ondelete="CASCADE"))
    infrastructure_object_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("infrastructure_objects.id", ondelete="SET NULL"), nullable=True
    )
    length_km: Mapped[float] = mapped_column(Float, default=0)

    network: Mapped["InfrastructureNetwork"] = relationship(back_populates="edges")
