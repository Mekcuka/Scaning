import uuid
from datetime import date, datetime

from sqlalchemy import JSON, BigInteger, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.geo.columns import geometry_any_column, geometry_point_column
from app.models.enums import UserRole


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    username: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(50), default=UserRole.analyst.value)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    projects: Mapped[list["Project"]] = relationship(back_populates="owner")
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")


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
    economic_params: Mapped["ProjectEconomicParams | None"] = relationship(
        back_populates="project", uselist=False, cascade="all, delete-orphan"
    )
    footprint_connection_template: Mapped["ProjectFootprintConnectionTemplate | None"] = relationship(
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
    one_pagers: Mapped[list["OnePager"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    map3d_models: Mapped[list["ProjectMap3dModel"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    sand_logistics_result: Mapped["ProjectSandLogisticsResult | None"] = relationship(
        back_populates="project", uselist=False, cascade="all, delete-orphan"
    )
    line_dem: Mapped["ProjectLineDem | None"] = relationship(
        back_populates="project", uselist=False, cascade="all, delete-orphan"
    )


class ProjectMap3dModel(Base):
    __tablename__ = "project_map3d_models"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(255))
    target_height_m: Mapped[float] = mapped_column(Float, default=8.0)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    content_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    assigned_subtypes: Mapped[list] = mapped_column(JSON, nullable=False, default=list, server_default="[]")
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    project: Mapped["Project"] = relationship(back_populates="map3d_models")


class ProjectCostRates(Base):
    __tablename__ = "project_cost_rates"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("projects.id", ondelete="CASCADE"), unique=True)
    rates: Mapped[dict] = mapped_column(JSON, default=dict)

    project: Mapped["Project"] = relationship(back_populates="cost_rates")


class ProjectEconomicParams(Base):
    __tablename__ = "project_economic_params"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("projects.id", ondelete="CASCADE"), unique=True)
    params: Mapped[dict] = mapped_column(JSON, default=dict)

    project: Mapped["Project"] = relationship(back_populates="economic_params")


class ProjectFootprintConnectionTemplate(Base):
    __tablename__ = "project_footprint_connection_templates"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), unique=True
    )
    template: Mapped[dict] = mapped_column(JSON, default=dict)

    project: Mapped["Project"] = relationship(back_populates="footprint_connection_template")


class ProjectSandLogisticsResult(Base):
    """Last sand logistics analysis snapshot per project."""

    __tablename__ = "project_sand_logistics_results"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), unique=True
    )
    as_of: Mapped[date] = mapped_column(Date, nullable=False)
    horizon_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    horizon_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    network_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    result: Mapped[dict] = mapped_column(JSON, default=dict)
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    calculated_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    project: Mapped["Project"] = relationship(back_populates="sand_logistics_result")


class ProjectDistanceDefaults(Base):
    __tablename__ = "project_distance_defaults"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("projects.id", ondelete="CASCADE"), unique=True)
    threshold_gas_processing_km: Mapped[float] = mapped_column(Float, default=80.0)
    threshold_gtes_km: Mapped[float] = mapped_column(Float, default=60.0)
    threshold_substation_km: Mapped[float] = mapped_column(Float, default=25.0)
    threshold_refinery_km: Mapped[float] = mapped_column(Float, default=100.0)
    threshold_ground_pumping_station_km: Mapped[float] = mapped_column(Float, default=50.0)
    threshold_sand_quarry_km: Mapped[float] = mapped_column(Float, default=50.0)
    max_total_line_autoroad_km: Mapped[float] = mapped_column(Float, default=50.0)
    max_total_line_oil_pipeline_km: Mapped[float] = mapped_column(Float, default=40.0)
    max_total_line_gas_pipeline_km: Mapped[float] = mapped_column(Float, default=40.0)
    max_total_line_water_pipeline_km: Mapped[float] = mapped_column(Float, default=30.0)
    max_total_line_power_line_km: Mapped[float] = mapped_column(Float, default=30.0)
    max_total_line_methanol_pipeline_km: Mapped[float] = mapped_column(Float, default=40.0)
    max_total_line_additional_line_km: Mapped[float] = mapped_column(Float, default=50.0)
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
    gas_factor: Mapped[float] = mapped_column(Float, default=120.0)
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
    threshold_ground_pumping_station_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    threshold_sand_quarry_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_total_line_autoroad_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_total_line_oil_pipeline_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_total_line_gas_pipeline_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_total_line_water_pipeline_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_total_line_power_line_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_total_line_methanol_pipeline_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_total_line_additional_line_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    cost_rates: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    economic_params: Mapped[dict | None] = mapped_column(JSON, nullable=True)
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
    flow_schematic_layout: Mapped["PoiFlowSchematicLayout | None"] = relationship(
        back_populates="poi", cascade="all, delete-orphan", uselist=False
    )


class PoiFlowSchematicLayout(Base):
    """User-edited PFD layout per POI (nodes, edges, positions)."""

    __tablename__ = "poi_flow_schematic_layouts"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    poi_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("points_of_interest.id", ondelete="CASCADE"), unique=True
    )
    nodes: Mapped[list] = mapped_column(JSON, default=list)
    edges: Mapped[list] = mapped_column(JSON, default=list)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    poi: Mapped["PointOfInterest"] = relationship(back_populates="flow_schematic_layout")


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
    pad_dem: Mapped["InfraObjectPadDem | None"] = relationship(
        back_populates="infrastructure_object",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class ProjectLineDem(Base):
    __tablename__ = "project_line_dem"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), unique=True, index=True
    )
    bbox_hash: Mapped[str] = mapped_column(String(16), nullable=False)
    bbox_west: Mapped[float] = mapped_column(Float, nullable=False)
    bbox_south: Mapped[float] = mapped_column(Float, nullable=False)
    bbox_east: Mapped[float] = mapped_column(Float, nullable=False)
    bbox_north: Mapped[float] = mapped_column(Float, nullable=False)
    source: Mapped[str] = mapped_column(String(64), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    project: Mapped["Project"] = relationship(back_populates="line_dem")


class InfraObjectPadDem(Base):
    __tablename__ = "infra_object_pad_dem"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    infrastructure_object_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("infrastructure_objects.id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    bbox_hash: Mapped[str] = mapped_column(String(16), nullable=False)
    bbox_west: Mapped[float] = mapped_column(Float, nullable=False)
    bbox_south: Mapped[float] = mapped_column(Float, nullable=False)
    bbox_east: Mapped[float] = mapped_column(Float, nullable=False)
    bbox_north: Mapped[float] = mapped_column(Float, nullable=False)
    source: Mapped[str] = mapped_column(String(64), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    infrastructure_object: Mapped["InfrastructureObject"] = relationship(back_populates="pad_dem")


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


class OnePager(Base):
    __tablename__ = "one_pagers"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("projects.id", ondelete="CASCADE"))
    poi_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("points_of_interest.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255))
    coordinates: Mapped[str | None] = mapped_column(String(100), nullable=True)
    engineer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    report_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    final_variant_data: Mapped[dict] = mapped_column(JSON, default=dict)
    engineering_params: Mapped[dict] = mapped_column(JSON, default=dict)
    roadmap: Mapped[list] = mapped_column(JSON, default=list)
    recommendation_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_recommendation_edited: Mapped[bool] = mapped_column(Boolean, default=False)
    map_snapshot_base64: Mapped[str | None] = mapped_column(Text, nullable=True)
    pdf_file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pptx_file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    generation_status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    project: Mapped["Project"] = relationship(back_populates="one_pagers")


class ProjectJob(Base):
    __tablename__ = "project_jobs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"))
    job_type: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    progress: Mapped[float | None] = mapped_column(Float, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    steps: Mapped[list["ProjectJobStep"]] = relationship(
        back_populates="job",
        cascade="all, delete-orphan",
        order_by="ProjectJobStep.seq",
    )


class ProjectJobStep(Base):
    __tablename__ = "project_job_steps"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("project_jobs.id", ondelete="CASCADE"), index=True
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    seq: Mapped[int] = mapped_column(Integer)
    step_code: Mapped[str] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(32), default="pending")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    detail: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    job: Mapped["ProjectJob"] = relationship(back_populates="steps")


class ImportLog(Base):
    __tablename__ = "import_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_job_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("project_jobs.id", ondelete="SET NULL"), nullable=True
    )
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


class AssistantAuditLog(Base):
    __tablename__ = "assistant_audit_log"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    tool_name: Mapped[str] = mapped_column(String(128), index=True)
    args_hash: Mapped[str] = mapped_column(String(64))
    ok: Mapped[bool] = mapped_column(Boolean, default=False)
    code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    source: Mapped[str] = mapped_column(String(16), default="chat")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class AssistantChatSession(Base):
    __tablename__ = "assistant_chat_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), default="Новый чат")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), index=True
    )

    messages: Mapped[list["AssistantChatMessage"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="AssistantChatMessage.seq"
    )


class AssistantChatMessage(Base):
    __tablename__ = "assistant_chat_messages"
    __table_args__ = (UniqueConstraint("session_id", "seq", name="uq_assistant_chat_messages_session_seq"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("assistant_chat_sessions.id", ondelete="CASCADE"), index=True
    )
    seq: Mapped[int] = mapped_column(Integer)
    role: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text)
    reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    tool_calls_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["AssistantChatSession"] = relationship(back_populates="messages")
