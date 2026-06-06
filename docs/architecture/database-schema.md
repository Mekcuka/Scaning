# Схема базы данных

> **Параметры ввода:** id полей и значения по умолчанию — [input-parameters.md](../product/input-parameters.md).  
> **Геометрия объектов и якоря расчёта:** [map-objects-and-spatial-calculations.md](../features/map-objects-and-spatial-calculations.md).

## ER-диаграмма

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     users       │     │     roles       │     │  user_roles     │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │     │ user_id (FK)    │
│ email           │     │ name            │     │ role_id (FK)    │
│ password_hash   │     │ description     │     └─────────────────┘
│ username        │     └─────────────────┘
│ avatar_url      │
│ created_at      │
│ updated_at      │
└─────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐     ┌─────────────────┐
│  map_layers     │     │  geo_objects    │
├─────────────────┤     ├─────────────────┤
│ id (PK)         │◄────│ layer_id (FK)   │
│ user_id (FK)    │     │ id (PK)         │
│ name            │     │ name            │
│ type            │     │ geometry (GIS)  │
│ source_type     │     │ properties      │
│ style_config    │     │ created_at      │
│ is_visible      │     │ updated_at      │
│ opacity         │     └─────────────────┘
│ created_at      │
│ updated_at      │
└─────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ criterion_groups│     │    criteria     │     │ weight_presets  │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id (PK)         │◄────│ group_id (FK)   │     │ id (PK)         │
│ user_id (FK)    │     │ id (PK)         │     │ user_id (FK)    │
│ name            │     │ user_id (FK)    │     │ name            │
│ description     │     │ name            │     │ weights         │
│ created_at      │     │ description     │     │ created_at      │
│ updated_at      │     │ type            │     └─────────────────┘
└─────────────────┘     │ unit            │
                        │ min_value       │
                        │ max_value       │
                        │ weight          │
                        │ normalization   │
                        │ created_at      │
                        │ updated_at      │
                        └─────────────────┘
                                 │
                                 │ N:M
                                 ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   alternatives  │     │ decision_matrices│    │ matrix_results  │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │     │ id (PK)         │
│ user_id (FK)    │     │ user_id (FK)    │     │ matrix_id (FK)  │
│ name            │     │ name            │     │ algorithm       │
│ description     │     │ description     │     │ ranking         │
│ geometry (GIS)  │     │ algorithm       │     │ normalized_matrix│
│ properties      │     │ status          │     │ weights_used    │
│ created_at      │     │ weights         │     │ calculated_at   │
│ updated_at      │     │ results         │     └─────────────────┘
└─────────────────┘     │ created_at      │
         │              │ updated_at      │
         │ N:M          └─────────────────┘
         │                       │
         │                       │ 1:N
         │                       ▼
         │              ┌─────────────────┐
         │              │     reports     │
         │              ├─────────────────┤
         │              │ id (PK)         │
         │              │ user_id (FK)    │
         │              │ matrix_id (FK)  │
         │              │ name            │
         │              │ format          │
         │              │ status          │
         │              │ file_path       │
         │              │ comments        │
         │              │ created_at      │
         │              └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ alt_matrix_link │     │  import_logs    │
├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │
│ alt_id (FK)     │     │ user_id (FK)    │
│ matrix_id (FK)  │     │ source_type     │
│ values          │     │ file_name       │
│ created_at      │     │ status          │
└─────────────────┘     │ records_total   │
                        │ records_imported│
                        │ errors          │
                        │ created_at      │
                        └─────────────────┘
```

---

## SQL Миграции

### Таблица users

> **Реализация MVP:** одна роль на пользователя — колонка `users.role` (`admin` | `analyst` | `data_manager` | `viewer`).  
> Таблицы `roles` / `user_roles` ниже — целевая схема v2 (multi-role). См. [auth-rbac.md](auth-rbac.md).

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'analyst'
        CHECK (role IN ('admin', 'analyst', 'data_manager', 'viewer')),
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
```

### Таблица refresh_tokens (реализовано)

```sql
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_refresh_tokens_user_id ON refresh_tokens(user_id);
```

### Таблица roles *(целевая схема v2, не реализована)*
```sql
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roles (name, description) VALUES
    ('admin', 'Полный доступ к системе'),
    ('analyst', 'Создание матриц и отчётов'),
    ('data_manager', 'Загрузка и управление слоями инфраструктуры'),
    ('viewer', 'Только просмотр');
```

### Таблица user_roles *(целевая схема v2, не реализована)*
```sql
CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);
```

### Таблица map_layers
```sql
CREATE TABLE map_layers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('vector', 'raster', 'heatmap')),
    source_type VARCHAR(50),
    source_url TEXT,
    style_config JSONB DEFAULT '{}',
    is_visible BOOLEAN DEFAULT true,
    opacity FLOAT DEFAULT 1.0 CHECK (opacity >= 0 AND opacity <= 1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_map_layers_user_id ON map_layers(user_id);
```

### Таблица geo_objects
```sql
CREATE TABLE geo_objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layer_id UUID NOT NULL REFERENCES map_layers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    geometry GEOMETRY NOT NULL,
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT enforce_srid CHECK (ST_SRID(geometry) = 4326)
);

CREATE INDEX idx_geo_objects_layer_id ON geo_objects(layer_id);
CREATE INDEX idx_geo_objects_geometry ON geo_objects USING GIST (geometry);
CREATE INDEX idx_geo_objects_properties ON geo_objects USING GIN (properties);
```

### Таблица criterion_groups
```sql
CREATE TABLE criterion_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_criterion_groups_user_id ON criterion_groups(user_id);
```

### Таблица criteria
```sql
CREATE TABLE criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('benefit', 'cost')),
    value_source VARCHAR(20) NOT NULL DEFAULT 'computed'
        CHECK (value_source IN ('computed', 'user')),
    unit VARCHAR(50),
    min_value FLOAT,
    max_value FLOAT,
    weight FLOAT DEFAULT 0.0,
    normalization_method VARCHAR(20) DEFAULT 'min-max' 
        CHECK (normalization_method IN ('min-max', 'z-score', 'vector')),
    group_id UUID REFERENCES criterion_groups(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_criteria_user_id ON criteria(user_id);
CREATE INDEX idx_criteria_group_id ON criteria(group_id);
```

**Seed MVP (справочник, legacy):** таблица `criteria` относится к универсальным `decision_matrices` и не используется инфраструктурной матрицей MVP.

### Таблица weight_presets
```sql
CREATE TABLE weight_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    weights JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_weight_presets_user_id ON weight_presets(user_id);
```

### Таблица alternatives
```sql
CREATE TABLE alternatives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    geometry GEOMETRY,
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT enforce_alt_srid CHECK (ST_SRID(geometry) = 4326)
);

CREATE INDEX idx_alternatives_user_id ON alternatives(user_id);
CREATE INDEX idx_alternatives_geometry ON alternatives USING GIST (geometry);
```

### Таблица decision_matrices (legacy, FR-14.1.3)

> **MVP:** сравнение точек интереса в инфраструктурной матрице использует `points_of_interest` + `poi_infrastructure_analysis`. Таблица ниже — для универсальных матриц (legacy, вне основного потока POI).

```sql
CREATE TABLE decision_matrices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    algorithm VARCHAR(50) NOT NULL 
        CHECK (algorithm IN ('ahp', 'topsis', 'wsm', 'electre', 'promethee')),
    criteria_ids UUID[] DEFAULT '{}',
    alternative_ids UUID[] DEFAULT '{}',
    weights JSONB DEFAULT '{}',
    results JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'draft' 
        CHECK (status IN ('draft', 'calculating', 'completed', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_decision_matrices_user_id ON decision_matrices(user_id);
CREATE INDEX idx_decision_matrices_status ON decision_matrices(status);
```

### Таблица alt_matrix_link (связь альтернатив с матрицами + значения)
```sql
CREATE TABLE alt_matrix_link (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alternative_id UUID NOT NULL REFERENCES alternatives(id) ON DELETE CASCADE,
    matrix_id UUID NOT NULL REFERENCES decision_matrices(id) ON DELETE CASCADE,
    values JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(alternative_id, matrix_id)
);

CREATE INDEX idx_alt_matrix_link_matrix_id ON alt_matrix_link(matrix_id);
CREATE INDEX idx_alt_matrix_link_alt_id ON alt_matrix_link(alternative_id);
```

### Таблица matrix_results
```sql
CREATE TABLE matrix_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matrix_id UUID NOT NULL REFERENCES decision_matrices(id) ON DELETE CASCADE,
    algorithm VARCHAR(50) NOT NULL,
    ranking JSONB NOT NULL DEFAULT '[]',
    normalized_matrix JSONB DEFAULT '[]',
    weights_used JSONB DEFAULT '{}',
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_matrix_results_matrix_id ON matrix_results(matrix_id);
```

### Таблица reports
```sql
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    matrix_id UUID REFERENCES decision_matrices(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    format VARCHAR(20) NOT NULL CHECK (format IN ('pdf', 'excel', 'csv')),
    status VARCHAR(20) DEFAULT 'pending' 
        CHECK (status IN ('pending', 'generating', 'ready', 'error')),
    file_path TEXT,
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reports_user_id ON reports(user_id);
CREATE INDEX idx_reports_status ON reports(status);
```

### Таблица import_logs
```sql
CREATE TABLE import_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL,
    file_name VARCHAR(255),
    status VARCHAR(20) NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'error')),
    records_total INTEGER DEFAULT 0,
    records_imported INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_import_logs_user_id ON import_logs(user_id);
CREATE INDEX idx_import_logs_status ON import_logs(status);
```

### Таблица import_connections (FR-2.5.9)

```sql
CREATE TABLE import_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    registry_type VARCHAR(50) NOT NULL,
    api_url TEXT NOT NULL,
    auth_type VARCHAR(20) NOT NULL CHECK (auth_type IN ('bearer', 'api_key', 'basic')),
    credentials_encrypted BYTEA NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_import_connections_project_id ON import_connections(project_id);
```

### Таблица audit_log (FR-1.3.3, Should Have)

```sql
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    payload JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
```

### Таблица projects
```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
    visibility VARCHAR(20) NOT NULL DEFAULT 'private'
        CHECK (visibility IN ('private', 'published')),
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
```

### Таблица project_distance_defaults (пороги и нормы по умолчанию, FR-4.1.5)

Одна строка на проект. При создании POI значения копируются в поля `points_of_interest`.

- **`max_distance_*`** (4 внешних Point): ГКС, ГТЭС, ПС/ТП, НПЗ — сравнение с geodesic до объекта.
- **`max_total_line_*`** (4 internal linear): автодорога, нефтепровод, водопровод, ЛЭП — сравнение с `pads_count × km_per_pad`.
- Колонки `max_distance_autoroad_km` … `max_distance_power_line_km` в таблице **сохранены** для радиусов на карте (FR-10.2); **не** используются для статуса internal linear.

```sql
CREATE TABLE project_distance_defaults (
    project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    max_distance_autoroad_km DECIMAL(10, 2) NOT NULL DEFAULT 50,
    max_distance_oil_pipeline_km DECIMAL(10, 2) NOT NULL DEFAULT 40,
    max_distance_water_pipeline_km DECIMAL(10, 2) NOT NULL DEFAULT 30,
    max_distance_gas_processing_km DECIMAL(10, 2) NOT NULL DEFAULT 80,
    max_distance_gtes_km DECIMAL(10, 2) NOT NULL DEFAULT 50,
    max_distance_substation_km DECIMAL(10, 2) NOT NULL DEFAULT 25,
    max_distance_refinery_km DECIMAL(10, 2) NOT NULL DEFAULT 100,
    max_distance_power_line_km DECIMAL(10, 2) NOT NULL DEFAULT 30,
    -- макс. суммарная длина internal linear (FR-6.2, сравнение с pads×km/КП)
    max_total_line_autoroad_km DECIMAL(10, 2) NOT NULL DEFAULT 50,
    max_total_line_oil_pipeline_km DECIMAL(10, 2) NOT NULL DEFAULT 40,
    max_total_line_water_pipeline_km DECIMAL(10, 2) NOT NULL DEFAULT 30,
    max_total_line_power_line_km DECIMAL(10, 2) NOT NULL DEFAULT 30,
    -- норма км линейной инфраструктуры на 1 кустовую площадку (FR-5.3.4)
    km_per_pad_autoroad DECIMAL(10, 2) NOT NULL DEFAULT 3.0,
    km_per_pad_oil_pipeline DECIMAL(10, 2) NOT NULL DEFAULT 3.0,
    km_per_pad_water_pipeline DECIMAL(10, 2) NOT NULL DEFAULT 3.0,
    km_per_pad_power_line DECIMAL(10, 2) NOT NULL DEFAULT 3.0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Таблица project_cost_rates (ставки стоимости проекта)

**UI:** 16 строк на проект, ввод в **тыс. ₽** (экран «Ставки»). В БД — `rate_thousand_rub` (значение в тысячах рублей).

**Миграция POI:** `on_site_separation` + `use_collection_point` → `oil_preparation_type` (`true` → `mkos`, `false` → `mfns`).

**Миграция подтипов (май 2026):** удалены `gas_pipeline`, `collection_point`, `water_intake`, `marine_terminal` из CHECK и полей порогов; соответствующие строки `project_cost_rates` и записи анализа — архивировать или удалить.

```sql
CREATE TABLE project_cost_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    infrastructure_type VARCHAR(50) NOT NULL 
        CHECK (infrastructure_type IN ('road', 'pipeline', 'area_facility', 'electricity')),
    subtype VARCHAR(50) NOT NULL
        CHECK (subtype IN (
            'autoroad',
            'oil_pipeline', 'water_pipeline',
            'gas_processing',
            'refinery',
            'power_line', 'gtes', 'substation',
            'pads'
        )),
    rate_thousand_rub DECIMAL(15, 2) NOT NULL DEFAULT 0,
    rate_unit VARCHAR(20) NOT NULL DEFAULT 'per_km'
        CHECK (rate_unit IN ('per_km', 'fixed', 'per_unit')),
    currency VARCHAR(3) DEFAULT 'RUB',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, infrastructure_type, subtype)
);

CREATE INDEX idx_project_cost_rates_project_id ON project_cost_rates(project_id);
```

### Таблица project_sand_logistics_results (снимок логистики песка)

Один последний результат расчёта на проект. Заполняется при `POST .../sand-logistics/analyze`; читается через `GET .../sand-logistics/result`.

```sql
CREATE TABLE project_sand_logistics_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    as_of DATE NOT NULL,
    network_id UUID,
    result JSONB NOT NULL DEFAULT '{}',
    calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    calculated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);
```

Поле `result` хранит `subnet_count`, `subnets`, `warnings`, `object_names`. Верхнеуровневые `project_id`, `as_of`, `network_id` дублируются в колонках для индексации и отображения.

### Таблица points_of_interest (точки интереса)
```sql
CREATE TABLE points_of_interest (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    geometry GEOMETRY NOT NULL,
    fluid_type VARCHAR(20) NOT NULL DEFAULT 'oil'
        CHECK (fluid_type IN ('oil', 'gas')),
    planned_production_volume DECIMAL(15, 2),
    water_injection_volume DECIMAL(15, 2) NOT NULL DEFAULT 0,
    production_per_well DECIMAL(15, 2) NOT NULL DEFAULT 10,
    wells_per_pad INTEGER NOT NULL DEFAULT 4,
    production_unit VARCHAR(30) NOT NULL DEFAULT 'thousand_tons_per_year',
    extended_params JSONB NOT NULL DEFAULT '{}',
    -- инженерные параметры (см. input-parameters.md §2.2)
    power_supply_type VARCHAR(20) CHECK (power_supply_type IN ('external', 'internal')),
    injection_method VARCHAR(20) CHECK (injection_method IN ('centralized', 'local')),
    gas_utilization_type VARCHAR(20) CHECK (gas_utilization_type IN ('well', 'flare', 'power_generation')),
    oil_preparation_type VARCHAR(20) NOT NULL DEFAULT 'mfns'
        CHECK (oil_preparation_type IN ('mkos', 'bmupn', 'cps', 'upsv', 'mfns')),
    well_gathering_type VARCHAR(20) NOT NULL DEFAULT 'single_tube'
        CHECK (well_gathering_type IN ('single_tube', 'dual_tube', 'combined')),
    transport_type VARCHAR(20) CHECK (transport_type IN ('auto', 'marine', 'pipeline')),
    -- пороговые расстояния (переопределение; наследуются из project_distance_defaults)
    max_distance_autoroad_km DECIMAL(10, 2) DEFAULT 50,
    max_distance_oil_pipeline_km DECIMAL(10, 2) DEFAULT 40,
    max_distance_water_pipeline_km DECIMAL(10, 2) DEFAULT 30,
    max_distance_refinery_km DECIMAL(10, 2) DEFAULT 100,
    max_distance_gas_processing_km DECIMAL(10, 2) DEFAULT 80,
    max_distance_power_line_km DECIMAL(10, 2) DEFAULT 30,
    max_distance_gtes_km DECIMAL(10, 2) DEFAULT 50,
    max_distance_substation_km DECIMAL(10, 2) DEFAULT 25,
    km_per_pad_autoroad DECIMAL(10, 2) DEFAULT 3.0,
    km_per_pad_oil_pipeline DECIMAL(10, 2) DEFAULT 3.0,
    km_per_pad_water_pipeline DECIMAL(10, 2) DEFAULT 3.0,
    km_per_pad_power_line DECIMAL(10, 2) DEFAULT 3.0,
    max_total_line_autoroad_km DECIMAL(10, 2) DEFAULT 50,
    max_total_line_oil_pipeline_km DECIMAL(10, 2) DEFAULT 40,
    max_total_line_water_pipeline_km DECIMAL(10, 2) DEFAULT 30,
    max_total_line_power_line_km DECIMAL(10, 2) DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT enforce_poi_srid CHECK (ST_SRID(geometry) = 4326)
);

CREATE INDEX idx_points_of_interest_project_id ON points_of_interest(project_id);
CREATE INDEX idx_points_of_interest_geometry ON points_of_interest USING GIST (geometry);
```

### Таблица poi_flow_schematic_layouts (макет PFD на POI)

Пользовательский макет схемы потоков: позиции узлов, ручные блоки, сохранённые лимиты. Расчётная топология пересобирается при GET (см. [fluid-flow-schematic.md](../features/fluid-flow-schematic.md) §6).

```sql
CREATE TABLE poi_flow_schematic_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poi_id UUID NOT NULL UNIQUE REFERENCES points_of_interest(id) ON DELETE CASCADE,
    nodes JSONB NOT NULL DEFAULT '[]',
    edges JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

Поля `flow_annual`, `flow_unit`, `over_capacity` в узлах layout **не сохраняются** — вычисляются при каждом запросе.

### Таблица infrastructure_layers (слои инфраструктуры проекта)
```sql
CREATE TABLE infrastructure_layers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    layer_type VARCHAR(50) NOT NULL 
        CHECK (layer_type IN ('road', 'pipeline', 'area_facility', 'electricity')),
    source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('corporate_api', 'csv_import', 'manual')),
    map_layer_id UUID REFERENCES map_layers(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_infrastructure_layers_project_id ON infrastructure_layers(project_id);
```

### Таблица infrastructure_objects (объекты инфраструктуры — 9 подтипов)

Геометрия согласована с подтипом (FR-2.3.7): площадные/подстанции — `POINT`; линейные — `LINESTRING` / `MULTILINESTRING`.

```sql
CREATE TABLE infrastructure_objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layer_id UUID NOT NULL REFERENCES infrastructure_layers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    geometry GEOMETRY NOT NULL,
    category VARCHAR(50) NOT NULL 
        CHECK (category IN ('road', 'pipeline', 'area_facility', 'electricity')),
    subtype VARCHAR(50) NOT NULL
        CHECK (subtype IN (
            'autoroad',
            'oil_pipeline', 'water_pipeline',
            'gas_processing',
            'refinery',
            'power_line', 'gtes', 'substation'
        )),
    properties JSONB DEFAULT '{}',
    is_auto_classified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT enforce_io_srid CHECK (ST_SRID(geometry) = 4326),
    CONSTRAINT chk_io_geometry_by_subtype CHECK (
        (
            subtype IN ('gas_processing', 'gtes', 'substation', 'refinery')
            AND ST_GeometryType(geometry) IN ('ST_Point', 'ST_MultiPoint')
        )
        OR (
            subtype IN ('autoroad', 'oil_pipeline', 'water_pipeline', 'power_line')
            AND ST_GeometryType(geometry) IN ('ST_LineString', 'ST_MultiLineString')
        )
    )
);

CREATE INDEX idx_infrastructure_objects_layer_id ON infrastructure_objects(layer_id);
CREATE INDEX idx_infrastructure_objects_subtype ON infrastructure_objects(subtype);
CREATE INDEX idx_infrastructure_objects_geometry ON infrastructure_objects USING GIST (geometry);
```

**Ключи `properties` для PFD (MVP):** `throughput_capacity_annual` (number), `capacity_unit` (`thousand_t_per_year` | `thousand_m3_per_year`) — см. [map-objects-and-spatial-calculations.md](../features/map-objects-and-spatial-calculations.md) §1.6.

### Таблица poi_infrastructure_analysis (анализ окружения точки — 9 подтипов)

Поля `anchor_*` — точка привязки для расстояния и линии на карте (FR-2.4.4).

```sql
CREATE TABLE poi_infrastructure_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poi_id UUID NOT NULL REFERENCES points_of_interest(id) ON DELETE CASCADE,
    param_type VARCHAR(20) NOT NULL DEFAULT 'external' CHECK (param_type IN ('internal', 'external')),
    subtype VARCHAR(50) NOT NULL
        CHECK (subtype IN (
            'autoroad',
            'oil_pipeline', 'water_pipeline',
            'gas_processing',
            'refinery',
            'power_line', 'gtes', 'substation'
        )),
    nearest_object_id UUID REFERENCES infrastructure_objects(id) ON DELETE SET NULL,
    nearest_node_id UUID,  -- FK → infrastructure_nodes(id), planned (FR-2.4.5)
    distance_km DECIMAL(10, 2),
    distance_source VARCHAR(30) NOT NULL DEFAULT 'geodesic'
        CHECK (distance_source IN ('geodesic', 'pads_per_pad_formula', 'manual_override')),
    distance_method VARCHAR(20) NOT NULL DEFAULT 'geodesic'
        CHECK (distance_method IN ('geodesic', 'along_network')),
    anchor_type VARCHAR(20)
        CHECK (anchor_type IS NULL OR anchor_type IN ('point_object', 'line_nearest_point', 'network_node')),
    anchor_geometry GEOMETRY(POINT, 4326),
    distance_status VARCHAR(20) NOT NULL CHECK (distance_status IN ('within_limit', 'exceeds_limit', 'construction_required', 'not_required')),
    max_allowed_distance_km DECIMAL(10, 2) NOT NULL,
    is_manually_overridden BOOLEAN DEFAULT false,
    overridden_object_id UUID REFERENCES infrastructure_objects(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT enforce_pia_anchor_srid CHECK (
        anchor_geometry IS NULL OR ST_SRID(anchor_geometry) = 4326
    )
);
CREATE INDEX idx_poi_analysis_poi_id ON poi_infrastructure_analysis(poi_id);
CREATE INDEX idx_poi_analysis_subtype ON poi_infrastructure_analysis(subtype);
CREATE INDEX idx_poi_analysis_anchor_geometry ON poi_infrastructure_analysis USING GIST (anchor_geometry);
```

> **MVP:** внешние — `distance_source = geodesic`, `anchor_type = point_object`. Внутренние линейные — `distance_source = pads_per_pad_formula`, `nearest_object_id` и `anchor_geometry` = NULL. Ручное переопределение — `manual_override`. `network_node` — planned (FR-2.4.5).

### Planned: топология сети (не MVP)

Явный граф для линейной инфраструктуры. Спецификация: [map-objects-and-spatial-calculations.md](../features/map-objects-and-spatial-calculations.md) §5.

```sql
CREATE TABLE infrastructure_networks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    layer_id UUID REFERENCES infrastructure_layers(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    subtype VARCHAR(50) NOT NULL,
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE infrastructure_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    network_id UUID NOT NULL REFERENCES infrastructure_networks(id) ON DELETE CASCADE,
    infrastructure_object_id UUID REFERENCES infrastructure_objects(id) ON DELETE SET NULL,
    name VARCHAR(255),
    geometry GEOMETRY(POINT, 4326) NOT NULL,
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT enforce_in_node_srid CHECK (ST_SRID(geometry) = 4326)
);
CREATE INDEX idx_infrastructure_nodes_network_id ON infrastructure_nodes(network_id);
CREATE INDEX idx_infrastructure_nodes_geometry ON infrastructure_nodes USING GIST (geometry);

CREATE TABLE infrastructure_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    network_id UUID NOT NULL REFERENCES infrastructure_networks(id) ON DELETE CASCADE,
    from_node_id UUID NOT NULL REFERENCES infrastructure_nodes(id) ON DELETE CASCADE,
    to_node_id UUID NOT NULL REFERENCES infrastructure_nodes(id) ON DELETE CASCADE,
    infrastructure_object_id UUID REFERENCES infrastructure_objects(id) ON DELETE SET NULL,
    geometry GEOMETRY(LINESTRING, 4326) NOT NULL,
    length_km DECIMAL(10, 4),
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT enforce_ie_srid CHECK (ST_SRID(geometry) = 4326)
);
CREATE INDEX idx_infrastructure_edges_network_id ON infrastructure_edges(network_id);
CREATE INDEX idx_infrastructure_edges_geometry ON infrastructure_edges USING GIST (geometry);

-- После создания таблиц:
-- ALTER TABLE poi_infrastructure_analysis
--   ADD CONSTRAINT fk_pia_nearest_node
--   FOREIGN KEY (nearest_node_id) REFERENCES infrastructure_nodes(id) ON DELETE SET NULL;
```

### Таблица implementation_variants (базовый вариант на POI)
```sql
CREATE TABLE implementation_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    poi_id UUID NOT NULL REFERENCES points_of_interest(id) ON DELETE CASCADE,
    matrix_id UUID REFERENCES decision_matrices(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    variant_type VARCHAR(20) NOT NULL DEFAULT 'base' CHECK (variant_type IN ('base')),
    -- snapshot применённых инженерных параметров (ссылка на POI как источник истины)
    applied_params JSONB NOT NULL DEFAULT '{}',
    -- стоимость
    engineering_equipment_cost DECIMAL(15, 2) DEFAULT 0,
    total_cost DECIMAL(15, 2) DEFAULT 0,
    -- общий статус (наихудший из всех активных подтипов)
    overall_status VARCHAR(20) DEFAULT 'within_limit' CHECK (overall_status IN ('within_limit', 'exceeds_limit', 'construction_required', 'not_required')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_implementation_variants_project_id ON implementation_variants(project_id);
CREATE INDEX idx_implementation_variants_poi_id ON implementation_variants(poi_id);
CREATE INDEX idx_implementation_variants_matrix_id ON implementation_variants(matrix_id);
CREATE INDEX idx_implementation_variants_overall_status ON implementation_variants(overall_status);
```

### Таблица variant_infrastructure_items (нормализация подтипов)
```sql
CREATE TABLE variant_infrastructure_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES implementation_variants(id) ON DELETE CASCADE,
    subtype VARCHAR(50) NOT NULL
        CHECK (subtype IN (
            'autoroad',
            'oil_pipeline', 'water_pipeline',
            'gas_processing',
            'refinery',
            'power_line', 'gtes', 'substation'
        )),
    distance_km DECIMAL(10, 2),
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('within_limit', 'exceeds_limit', 'construction_required', 'not_required')),
    object_id UUID REFERENCES infrastructure_objects(id) ON DELETE SET NULL,
    calculated_cost DECIMAL(15, 2) DEFAULT 0,
    UNIQUE(variant_id, subtype)
);
CREATE INDEX idx_variant_items_variant_id ON variant_infrastructure_items(variant_id);
CREATE INDEX idx_variant_items_subtype ON variant_infrastructure_items(subtype);
```

### Таблица variant_cost_overrides (ручные корректировки по подтипу)
```sql
CREATE TABLE variant_cost_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES implementation_variants(id) ON DELETE CASCADE,
    subtype VARCHAR(50) NOT NULL
        CHECK (subtype IN (
            'autoroad',
            'oil_pipeline', 'water_pipeline',
            'gas_processing',
            'refinery',
            'power_line', 'gtes', 'substation'
        )),
    manual_cost DECIMAL(15, 2) NOT NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(variant_id, subtype)
);
CREATE INDEX idx_cost_overrides_variant_id ON variant_cost_overrides(variant_id);
```

### Таблица one_pagers (одностраничники для руководства)

> **MVP:** одностраничник привязан к `poi_id`; snapshot строится из `poi_infrastructure_analysis` и инженерных параметров POI.

```sql
CREATE TABLE one_pagers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    poi_id UUID NOT NULL REFERENCES points_of_interest(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    coordinates VARCHAR(100),
    engineer_name VARCHAR(255),
    report_date DATE DEFAULT CURRENT_DATE,
    -- финальный вариант (JSON snapshot)
    final_variant_data JSONB NOT NULL DEFAULT '{}',
    -- инженерные параметры (snapshot из POI)
    engineering_params JSONB NOT NULL DEFAULT '{}',
    -- дорожная карта
    roadmap JSONB NOT NULL DEFAULT '[
        {"stage": "Разведка", "duration_months": 6},
        {"stage": "Изыскания", "duration_months": 12},
        {"stage": "ПИР", "duration_months": 18},
        {"stage": "Бурение", "duration_months": 24},
        {"stage": "Строительство", "duration_months": 36},
        {"stage": "Эксплуатация", "duration_months": null}
    ]',
    -- рекомендация
    recommendation_text TEXT,
    is_recommendation_edited BOOLEAN DEFAULT false,
    -- снимок карты (PNG base64 с клиента, для PPTX)
    map_snapshot_base64 TEXT,
    -- файлы
    pdf_file_path VARCHAR(500),
    pptx_file_path VARCHAR(500),
    generation_status VARCHAR(20) DEFAULT 'pending'
        CHECK (generation_status IN ('pending', 'ready', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_one_pagers_project_id ON one_pagers(project_id);
CREATE INDEX idx_one_pagers_poi_id ON one_pagers(poi_id);
```

---

## Триггеры

### Автоматическое обновление updated_at
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_map_layers_updated_at BEFORE UPDATE ON map_layers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_geo_objects_updated_at BEFORE UPDATE ON geo_objects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_criteria_updated_at BEFORE UPDATE ON criteria
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alternatives_updated_at BEFORE UPDATE ON alternatives
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_decision_matrices_updated_at BEFORE UPDATE ON decision_matrices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_cost_rates_updated_at BEFORE UPDATE ON project_cost_rates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_points_of_interest_updated_at BEFORE UPDATE ON points_of_interest
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_infrastructure_layers_updated_at BEFORE UPDATE ON infrastructure_layers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_variant_infrastructure_items_updated_at BEFORE UPDATE ON variant_infrastructure_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_variant_cost_overrides_updated_at BEFORE UPDATE ON variant_cost_overrides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_implementation_variants_updated_at BEFORE UPDATE ON implementation_variants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_infrastructure_objects_updated_at BEFORE UPDATE ON infrastructure_objects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_one_pagers_updated_at BEFORE UPDATE ON one_pagers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## PostGIS расширения

```sql
-- Включение PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Проверка версии
SELECT PostGIS_Version();
```

---

## Примеры запросов

### Поиск объектов в радиусе
```sql
SELECT 
    go.id,
    go.name,
    go.properties,
    ST_Distance(
        go.geometry::geography,
        ST_SetSRID(ST_MakePoint(37.6176, 55.7558), 4326)::geography
    ) AS distance_meters
FROM geo_objects go
WHERE ST_DWithin(
    go.geometry::geography,
    ST_SetSRID(ST_MakePoint(37.6176, 55.7558), 4326)::geography,
    50000  -- 50 км
)
ORDER BY distance_meters;
```

### Объекты внутри полигона
```sql
SELECT go.*
FROM geo_objects go
WHERE ST_Within(
    go.geometry,
    ST_GeomFromGeoJSON('{
        "type": "Polygon",
        "coordinates": [[
            [36.0, 54.0], [39.0, 54.0], [39.0, 56.0], [36.0, 56.0], [36.0, 54.0]
        ]]
    }')
);
```

### Поиск ближайших объектов инфраструктуры для точки интереса

**Точечный подтип** (внешние объекты):

```sql
SELECT io.id,
       io.name,
       io.subtype,
       ST_Distance(poi.geometry::geography, io.geometry::geography) / 1000.0 AS distance_km,
       io.geometry AS anchor_geometry,
       'point_object'::text AS anchor_type
FROM infrastructure_objects io
JOIN infrastructure_layers il ON il.id = io.layer_id
JOIN points_of_interest poi ON poi.id = :poi_id
WHERE il.project_id = poi.project_id
  AND io.subtype = :subtype
  AND ST_GeometryType(io.geometry) IN ('ST_Point', 'ST_MultiPoint')
ORDER BY distance_km
LIMIT 1;
```

**Линейный подтип** (ручной выбор / post-MVP):

```sql
SELECT io.id,
       io.name,
       io.subtype,
       ST_Distance(poi.geometry::geography, io.geometry::geography) / 1000.0 AS distance_km,
       ST_ClosestPoint(io.geometry, poi.geometry) AS anchor_geometry,
       'line_nearest_point'::text AS anchor_type
FROM infrastructure_objects io
JOIN infrastructure_layers il ON il.id = io.layer_id
JOIN points_of_interest poi ON poi.id = :poi_id
WHERE il.project_id = poi.project_id
  AND io.subtype = :subtype
  AND ST_GeometryType(io.geometry) IN ('ST_LineString', 'ST_MultiLineString')
ORDER BY distance_km
LIMIT 1;
```

### Варианты с превышением лимита
```sql
SELECT 
    iv.id,
    iv.name,
    iv.variant_type,
    iv.total_cost,
    iv.overall_status,
    poi.name AS poi_name
FROM implementation_variants iv
JOIN points_of_interest poi ON iv.poi_id = poi.id
WHERE iv.project_id = :project_id
  AND iv.overall_status = 'exceeds_limit'
ORDER BY iv.total_cost;
```

### Стоимость базовых вариантов по точкам интереса
```sql
SELECT 
    poi.name AS poi_name,
    COUNT(iv.id) AS variants,
    MIN(iv.total_cost) AS min_cost,
    MAX(iv.total_cost) AS max_cost,
    AVG(iv.total_cost) AS avg_cost
FROM points_of_interest poi
LEFT JOIN implementation_variants iv ON iv.poi_id = poi.id
WHERE poi.project_id = :project_id
GROUP BY poi.id, poi.name;
```

---

## Оптимизация

### Индексы для частых запросов
```sql
-- Поиск по названию объекта
CREATE INDEX idx_geo_objects_name ON geo_objects USING gin (name gin_trgm_ops);

-- Поиск по свойствам JSONB
CREATE INDEX idx_geo_objects_properties_gin ON geo_objects USING GIN (properties);

-- Поиск матриц по статусу и пользователю
CREATE INDEX idx_matrix_user_status ON decision_matrices(user_id, status);

-- Поиск альтернатив по пользователю
CREATE INDEX idx_alternatives_user_name ON alternatives(user_id, name);
```

### Разделение по схемам (опционально)
```sql
-- Схема для каждого пользователя (для изоляции данных)
CREATE SCHEMA user_550e8400_e29b_41d4_a716_446655440000;

-- Или разделение по проектам/организациям
CREATE SCHEMA org_acme_corp;
```

---

## Резервное копирование

```bash
# Полный бэкап
pg_dump -h localhost -U postgres -d decision_matrix_db > backup.sql

# Только схема
pg_dump -h localhost -U postgres -d decision_matrix_db --schema-only > schema.sql

# Восстановление
psql -h localhost -U postgres -d decision_matrix_db < backup.sql
```
