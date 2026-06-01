# Архитектура приложения

> **Параметры ввода:** [input-parameters.md](./input-parameters.md). Актуальная SQL-схема — [database-schema.md](./database-schema.md).  
> **Геометрия и пространственные расчёты:** [map-objects-and-spatial-calculations.md](./map-objects-and-spatial-calculations.md).  
> **Расчётные функции:** [calculation-functions.md](./calculation-functions.md).  
> **Схема потоков (PFD):** [fluid-flow-schematic.md](./fluid-flow-schematic.md) — отдельный визуальный поток от анализа окружения; использует граф сети и POI, не таблицу `poi_infrastructure_analysis`.  
> **Статус реализации:** [implementation-status.md](./implementation-status.md).

## Актуальная реализация (FastAPI + React, май 2026)

Код: `decision-matrix/`. Ниже в документе встречаются **исторические** блоки (NestJS/TypeScript) — они помечены как legacy-справка; ориентируйтесь на пути Python/React.

| Модуль | Backend | Frontend |
|--------|---------|----------|
| Auth | `api/v1/auth.py`, `admin.py` | `LoginPage`, `RegisterPage`, `AdminUsersPage` |
| Projects / POI | `api/v1/router.py` | `ProjectsPage`, `ProjectDetailPage` |
| Map + import | `api/v1/map.py`, `import_connections.py` | `MapPage`, `ImportPage` |
| Analysis | `services/infrastructure_analysis.py` | `MatrixPage`, карта |
| Reports | `api/v1/one_pagers.py` | `pages/report/*` |
| Flows PFD | `api/v1/flow.py`, `fluid_flow_schematic.py` | `pages/flows/*`, `FlowSchematicEditor` |
| Graph | `api/v1/graph.py`, `graph_builder.py` | PFD + карта |
| Sand | `api/v1/sand_logistics.py` | `SandParametersPage`, logistics schematic |

**Префикс API:** `/api/v1/projects/{project_id}/...` для проектных ресурсов; Swagger — `/api/v1/docs`.

---

## Общая архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend (React 18 + Vite)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Map View  │  │   Matrix    │  │   Reports & Dashboard   │  │
│  │ 2D: OL      │  │   Table &   │  │      & Dashboard        │  │
│  │ 3D: MapLibre│  │   Cards     │  │   (3D preview live)     │  │
│  │ + Import    │  │  + Map 3D   │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ REST API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Backend (FastAPI + Python)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────────┐  │
│  │   Auth   │ │   Map    │ │  Matrix  │ │    Projects       │  │
│  │  Module  │ │  Module  │ │  Module  │ │    Module         │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌───────────────────────────────┐  │
│  │  Reports │ │ Criteria │ │         User Mgmt             │  │
│  │  Module  │ │  Module  │ │           Module              │  │
│  └──────────┘ └──────────┘ └───────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
     ┌─────────────┐          ┌─────────────┐
     │  PostgreSQL │          │   External  │
     │   + PostGIS │          │  Data APIs  │
     └─────────────┘          └─────────────┘
```

---

## Модульная структура Backend

### 1. Auth Module
**Ответственность**: Аутентификация, авторизация (RBAC), управление сессиями

**Реализация (FastAPI):**

```
backend/app/
├── api/v1/auth.py           # register, login, refresh, logout, me
├── api/v1/admin.py          # users list, patch role/is_active, stats
├── api/rbac.py              # require_roles, require_admin
├── api/deps.py              # get_current_user (cookie/Bearer), verify_csrf
├── core/cookies.py          # Set-Cookie httpOnly + csrf_token
├── core/security.py         # JWT, bcrypt
├── services/auth_tokens.py  # refresh rotation, revoke
└── services/project_access.py  # resolve_project, list_accessible_projects

frontend/src/
├── pages/LoginPage.tsx, RegisterPage.tsx, AdminUsersPage.tsx
├── lib/permissions.ts, hooks/usePermissions.ts
└── components/RoleProtectedRoute.tsx
```

**API Endpoints** (`/api/v1/...`):
```
POST   /auth/register          - Регистрация (role=analyst)
POST   /auth/login             - Вход (Set-Cookie)
POST   /auth/refresh           - Обновление токена (rotation)
POST   /auth/logout            - Выход (revoke)
GET    /auth/me                - Текущий пользователь
GET    /admin/users            - Список пользователей (admin)
PATCH  /admin/users/:id        - Роль, is_active (admin)
GET    /admin/stats            - Агрегаты (admin)
```

Подробнее: [auth-rbac.md](./auth-rbac.md)

---

### 2. Map Module
**Ответственность**: Управление геоданными, слоями карты, геообъектами

**Реализация (FastAPI):** `api/v1/map.py`, `services/import_service.py`, `services/spatial.py`, `geo/constants.py`.

**API (факт, префикс `/api/v1`):**
```
GET/POST/PATCH/DELETE  /projects/{id}/infrastructure/layers
GET/POST/PATCH/DELETE  /projects/{id}/infrastructure/objects
POST                   /projects/{id}/import/preview
POST                   /projects/{id}/import/{csv|geojson|kml|shapefile|spark}
POST                   /projects/{id}/import/{format}/async   # 202
GET                    /import/logs
GET                    /projects/{id}/pois/{poiId}/analysis
GET                    /projects/{id}/pois/{poiId}/candidates
```

<details>
<summary>Историческая схема (NestJS, справка)</summary>

```
map/
├── controllers/
│   ├── layers.controller.ts
│   ├── geo-objects.controller.ts
│   └── map-config.controller.ts
├── services/
│   ├── layers.service.ts
│   ├── geo-objects.service.ts
│   ├── geocoding.service.ts
│   └── spatial-analysis.service.ts
├── dto/
│   ├── create-layer.dto.ts
│   ├── update-layer.dto.ts
│   └── geo-object-filter.dto.ts
├── entities/
│   ├── map-layer.entity.ts
│   ├── geo-object.entity.ts
│   └── map-settings.entity.ts
└── utils/
    ├── geojson-utils.ts
    ├── projection-utils.ts
    └── nearest-object-finder.ts   -- geodesic, anchor_type
```

**Пространственный анализ (MVP):** см. [calculation-functions.md](./calculation-functions.md) §1 (`find_nearest_object_by_subtype`, `calc_geodesic_distance_km`, `calc_anchor_geometry`).

**3D-атрибуты объектов (L2):** `render_3d_*` в `properties`, defaults L1 — [`render_3d_properties.py`](../decision-matrix/backend/app/geo/render_3d_properties.py), [`shared/l1_extrusion_heights.json`](../decision-matrix/shared/l1_extrusion_heights.json). См. [map-3d-features.md](./map-3d-features.md).

**API Endpoints**:
```
GET    /api/map/layers             - Список слоёв
POST   /api/map/layers             - Создать слой
PUT    /api/map/layers/:id         - Обновить слой
DELETE /api/map/layers/:id         - Удалить слой
GET    /api/map/objects            - Геообъекты (с фильтрами)
POST   /api/map/objects            - Создать геообъект
PUT    /api/map/objects/:id        - Обновить геообъект
DELETE /api/map/objects/:id        - Удалить геообъект
GET    /api/map/search             - Поиск по геообъектам
GET    /api/map/bounds             - Объекты в границах
POST   /api/map/import/geojson     - Импорт GeoJSON
POST   /api/map/import/csv         - Импорт CSV
POST   /api/map/import/shapefile   - Импорт Shapefile
GET    /api/map/import/status/:id  - Статус импорта
```

</details>

**PostGIS функции**:
```sql
-- Поиск объектов в радиусе
SELECT * FROM geo_objects 
WHERE ST_DWithin(
  geometry, 
  ST_MakePoint(:lon, :lat)::geography, 
  :radius_meters
);

-- Пересечение полигонов
SELECT * FROM geo_objects 
WHERE ST_Intersects(geometry, ST_GeomFromGeoJSON(:polygon));

-- Расчёт расстояния
SELECT ST_Distance(
  geometry1::geography, 
  geometry2::geography
) as distance_meters;
```

---

### 3. Criteria Module
**Ответственность**: Управление критериями для матрицы решений

```
criteria/
├── controllers/
│   └── criteria.controller.ts
├── services/
│   ├── criteria.service.ts
│   ├── weights.service.ts
│   └── normalization.service.ts
├── dto/
│   ├── create-criterion.dto.ts
│   ├── update-weights.dto.ts
│   └── pairwise-comparison.dto.ts  (для AHP)
├── entities/
│   ├── criterion.entity.ts
│   ├── criterion-group.entity.ts
│   └── weights-preset.entity.ts
└── utils/
    ├── ahp-calculator.ts
    └── normalization-utils.ts
```

**API Endpoints**:
```
GET    /api/criteria               - Список критериев
POST   /api/criteria               - Создать критерий
PUT    /api/criteria/:id           - Обновить критерий
DELETE /api/criteria/:id           - Удалить критерий
PUT    /api/criteria/weights       - Обновить веса
POST   /api/criteria/ahp-compare   - Парное сравнение (AHP)
GET    /api/criteria/weights/:id   - Получить веса пресета
```

**Сущность Criterion**:
```typescript
interface Criterion {
  id: string;
  name: string;
  description: string;
  type: 'benefit' | 'cost';  // benefit - больше лучше, cost - меньше лучше
  unit: string;              // ед. измерения
  min_value?: number;
  max_value?: number;
  weight: number;            // вес критерия (0-1)
  group_id?: string;         // группа критериев
  normalization_method: 'min-max' | 'z-score' | 'vector';
  created_at: Date;
  updated_at: Date;
}
```

---

### 5. Matrix Module (legacy / post-MVP)
**Ответственность**: Универсальные матрицы решений (`decision_matrices`). **Не используется** инфраструктурной матрицей MVP (FR-8).

```
matrix/
├── controllers/
│   ├── matrix.controller.ts
│   └── alternatives.controller.ts
├── services/
│   ├── matrix.service.ts
│   ├── algorithms/
│   │   ├── ahp.algorithm.ts
│   │   ├── topsis.algorithm.ts
│   │   ├── wsm.algorithm.ts
│   │   ├── electre.algorithm.ts
│   │   └── promethee.algorithm.ts
│   └── sensitivity-analysis.service.ts
├── dto/
│   ├── create-matrix.dto.ts
│   ├── calculate-matrix.dto.ts
│   └── sensitivity-analysis.dto.ts
├── entities/
│   ├── decision-matrix.entity.ts
│   ├── alternative.entity.ts
│   └── matrix-result.entity.ts
└── utils/
    ├── matrix-calculator.ts
    └── ranking-utils.ts
```

**API Endpoints**:
```
GET    /api/matrix                 - Список матриц
POST   /api/matrix                 - Создать матрицу
GET    /api/matrix/:id             - Детали матрицы
PUT    /api/matrix/:id             - Обновить матрицу
DELETE /api/matrix/:id            - Удалить матрицу
POST   /api/matrix/:id/calculate   - Рассчитать матрицу
GET    /api/matrix/:id/results     - Результаты расчёта
POST   /api/matrix/:id/sensitivity - Анализ чувствительности
GET    /api/alternatives           - Список альтернатив
POST   /api/alternatives           - Добавить альтернативу
PUT    /api/alternatives/:id       - Обновить альтернативу
DELETE /api/alternatives/:id       - Удалить альтернативу
```

**Алгоритм TOPSIS**:
```typescript
// 1. Нормализация матрицы решений
function normalizeMatrix(matrix: number[][]): number[][] {
  const normMatrix = [];
  const denom = matrix[0].map((_, j) => 
    Math.sqrt(matrix.reduce((sum, row) => sum + row[j] ** 2, 0))
  );
  
  for (const row of matrix) {
    normMatrix.push(row.map((val, j) => val / denom[j]));
  }
  return normMatrix;
}

// 2. Взвешенная нормализованная матрица
function applyWeights(normMatrix: number[][], weights: number[]): number[][] {
  return normMatrix.map(row => 
    row.map((val, j) => val * weights[j])
  );
}

// 3. Идеальное и анти-идеальное решение
function findIdealSolutions(weightedMatrix: number[][], types: string[]) {
  const ideal = [];
  const antiIdeal = [];
  
  for (let j = 0; j < weightedMatrix[0].length; j++) {
    const values = weightedMatrix.map(row => row[j]);
    if (types[j] === 'benefit') {
      ideal.push(Math.max(...values));
      antiIdeal.push(Math.min(...values));
    } else {
      ideal.push(Math.min(...values));
      antiIdeal.push(Math.max(...values));
    }
  }
  return { ideal, antiIdeal };
}

// 4. Расстояние до решений
function calculateDistances(weightedMatrix: number[][], ideal: number[], antiIdeal: number[]) {
  return weightedMatrix.map(row => ({
    d_ideal: Math.sqrt(row.reduce((sum, val, j) => sum + (val - ideal[j]) ** 2, 0)),
    d_anti: Math.sqrt(row.reduce((sum, val, j) => sum + (val - antiIdeal[j]) ** 2, 0))
  }));
}

// 5. Рейтинг альтернатив
function calculateScores(distances: Array<{d_ideal: number, d_anti: number}>) {
  return distances.map(d => d.d_anti / (d.d_ideal + d.d_anti));
}
```

---

### 6. Reports Module
**Ответственность**: Генерация отчётов, экспорт данных

```
reports/
├── controllers/
│   └── reports.controller.ts
├── services/
│   ├── reports.service.ts
│   ├── exporters/
│   │   ├── pdf-exporter.service.ts
│   │   ├── excel-exporter.service.ts
│   │   ├── csv-exporter.service.ts
│   │   └── geojson-exporter.service.ts
│   └── templates/
│       └── report-templates.ts
├── dto/
│   └── generate-report.dto.ts
├── entities/
│   └── report.entity.ts
└── templates/
    └── report-template.html
```

**API Endpoints**:
```
GET    /api/reports                - Список отчётов
POST   /api/reports/generate       - Сгенерировать отчёт
GET    /api/reports/:id            - Получить отчёт
GET    /api/reports/:id/download   - Скачать отчёт
DELETE /api/reports/:id            - Удалить отчёт
POST   /api/export/geojson         - Экспорт GeoJSON
POST   /api/export/excel           - Экспорт Excel
```

---

### 7. Projects Module
**Ответственность**: Управление проектами, точками интереса, инфраструктурой (9 подтипов), анализом и одностраничниками

```
projects/
├── controllers/
│   ├── projects.controller.ts
│   ├── points-of-interest.controller.ts
│   ├── infrastructure.controller.ts
│   ├── variants.controller.ts
│   └── one-pagers.controller.ts
├── services/
│   ├── projects.service.ts
│   ├── points-of-interest.service.ts
│   ├── infrastructure-analysis.service.ts
│   ├── infrastructure-objects.service.ts
│   ├── variants-generation.service.ts
│   ├── cost-calculation.service.ts
│   └── one-pager.service.ts
├── dto/
│   ├── create-project.dto.ts
│   ├── create-poi.dto.ts
│   ├── analyze-infrastructure.dto.ts
│   ├── adjust-cost.dto.ts
│   └── create-one-pager.dto.ts
├── entities/
│   ├── project.entity.ts
│   ├── point-of-interest.entity.ts
│   ├── infrastructure-layer.entity.ts
│   ├── infrastructure-object.entity.ts
│   ├── poi-analysis.entity.ts
│   ├── implementation-variant.entity.ts
│   ├── variant-infrastructure-item.entity.ts
│   ├── variant-cost-override.entity.ts
│   └── one-pager.entity.ts
└── utils/
    ├── nearest-object-finder.ts   -- FR-2.4.1–2.4.4; возвращает anchor_*
    ├── cost-calculator.ts
    └── one-pager-builder.ts
```

**Сервис `infrastructure-analysis.service` (MVP):**

```typescript
interface NearestInfrastructureResult {
  objectId: string;
  subtype: string;
  distanceKm: number;
  distanceSource: 'geodesic' | 'pads_per_pad_formula' | 'manual_override';
  anchorType?: 'point_object' | 'line_nearest_point' | 'network_node';
  anchorGeometry?: GeoJSON.Point;
  nearestNodeId?: string;
}
```

**API Endpoints**:
```
GET    /api/projects                    - Список проектов
POST   /api/projects                    - Создать проект
GET    /api/projects/:id                - Детали проекта
PUT    /api/projects/:id                - Обновить проект
DELETE /api/projects/:id                - Удалить проект

GET    /api/projects/:id/points         - Точки интереса
POST   /api/projects/:id/points         - Добавить точку
PUT    /api/projects/:id/points/:pid    - Обновить точку
DELETE /api/projects/:id/points/:pid    - Удалить точку

POST   /api/projects/:id/points/:pid/analyze         - Анализ окружения (9 подтипов)
GET    /api/projects/:id/points/:pid/candidates      - Кандидаты внешних Point (?subtype, limit)
PUT    /api/projects/:id/points/:pid/analysis/:subtype/override - Переопределить внешний объект
PATCH  /api/projects/:id/variants/:vid/items/:subtype - Override distance_km / km_per_pad (ручная корректировка)

GET    /api/projects/:id/infrastructure              - Слои инфраструктуры
POST   /api/projects/:id/infrastructure              - Добавить слой
GET    /api/projects/:id/infrastructure/objects      - Объекты инфраструктуры
POST   /api/projects/:id/infrastructure/objects      - Добавить объект

GET    /api/projects/:id/variants                    - Базовые варианты по POI
POST   /api/projects/:id/variants/calculate          - Рассчитать базовый вариант
PUT    /api/projects/:id/variants/:vid/cost          - Скорректировать стоимость

GET    /api/projects/:id/one-pagers                  - Список одностраничников
POST   /api/projects/:id/one-pagers                  - Создать одностраничник
GET    /api/projects/:id/one-pagers/:opid            - Получить одностраничник
PUT    /api/projects/:id/one-pagers/:opid            - Обновить одностраничник
POST   /api/projects/:id/one-pagers/:opid/export/pdf  - Экспорт PDF
POST   /api/projects/:id/one-pagers/:opid/export/pptx - Экспорт PowerPoint
```

### 8. Analytics Engine (post-MVP)
**Ответственность**: Аналитические расчёты, ML-модели (опционально, не входит в MVP)

```
analytics/  [папка зарезервирована для v1.3+]
├── services/
│   ├── spatial-analysis.service.ts
│   ├── statistical-analysis.service.ts
│   └── ml-models/
│       ├── clustering.service.ts     (k-means для зонирования)
│       └── regression.service.ts     (прогнозирование)
└── utils/
    ├── statistics-utils.ts
    └── ml-utils.ts
```

---

## Frontend архитектура

### Компоненты карты

Реализация 2D: `frontend/src/components/MapView.tsx`, `frontend/src/pages/MapPage.tsx`.  
Реализация 3D: `frontend/src/components/MapView3D.tsx`, `frontend/src/lib/map3d/` — см. [map-3d-features.md](./map-3d-features.md).

**Слои на карте (OpenLayers, 2D):** подложка, пороговые радиусы, линии подключения POI (анализ), линии/точки инфраструктуры, превью рисования. **Расчётный граф** (`infrastructure_nodes` / `infrastructure_edges`) **на карте не отображается** — только в БД и в API для «Потоков» / логистики. См. [map-objects-and-spatial-calculations.md](./map-objects-and-spatial-calculations.md) §5–§6.

**Режим 3D (MapLibre + Three.js, view-only):** те же объекты из API → `geoJson.ts` + custom layers (glTF точки, трубы линий), MapTiler terrain, без редактирования. Переключатель 2D|3D на MapPage; также Matrix и превью отчёта.

```
components/map/   # целевая структура; фактически — MapView.tsx + MapPage
├── MapView.tsx              # OpenLayers: инфраструктура, POI, линии анализа, редактирование геометрии
├── MapView3D.tsx            # MapLibre + Three.js custom layers (см. lib/map3d/)
├── Layers/
│   ├── LayerControl.tsx     # Переключатель слоёв
│   ├── BaseLayer.tsx        # Базовый слой (OSM, Satellite)
│   ├── DataLayer.tsx        # Слой данных
│   └── HeatmapLayer.tsx     # Тепловая карта
├── Markers/
│   ├── GeoMarker.tsx        # Маркер геообъекта
│   ├── ClusterMarker.tsx    # Кластер маркеров
│   └── CustomMarker.tsx     # Кастомный маркер
├── Controls/
│   ├── ZoomControl.tsx
│   ├── SearchControl.tsx    # Поиск по карте
│   ├── DrawControl.tsx      # Рисование на карте
│   └── MeasureControl.tsx   # Измерение расстояний
└── Popups/
    ├── ObjectPopup.tsx      # Поп-ап объекта
    └── InfoPopup.tsx        # Информационный поп-ап
```

### Компоненты импорта и ставок

```
components/import/
├── ImportApiPanel.tsx       # FR-2.5.1–2.5.2
├── ImportFilePanel.tsx      # FR-2.5.3–2.5.5
└── ImportHistory.tsx        # Журнал импортов

components/cost-rates/
├── CostRatesPage.tsx        # FR-4.1.2 — 16 показателей, тыс. ₽
└── CostRatesSummary.tsx     # Сводка в карточке проекта
```

### Компоненты матрицы

```
components/matrix/
├── MatrixTable.tsx          # Вертикальная таблица (FR-8.1.1)
├── MatrixCardView.tsx       # Карточный вид POI
├── CriteriaPanel.tsx        # Панель критериев
├── WeightsEditor.tsx        # Редактор весов
├── AlternativesEditor.tsx   # Редактор альтернатив
├── ResultsView.tsx          # Визуализация результатов
├── SensitivityChart.tsx     # График чувствительности
└── ComparisonChart.tsx      # Сравнение альтернатив
```

### State Management

```
store/
├── map.store.ts             # Состояние карты (центр, зум, слои)
├── matrix.store.ts          # Состояние матрицы (критерии, альтернативы)
├── criteria.store.ts        # Состояние критериев
├── user.store.ts            # Состояние пользователя
└── ui.store.ts              # UI состояние (модалки, уведомления)
```

---

## База данных (PostgreSQL + PostGIS)

### Таблица users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(100) NOT NULL,
  role VARCHAR(50) DEFAULT 'analyst',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Таблица map_layers
```sql
CREATE TABLE map_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,  -- vector, raster, heatmap
  source_type VARCHAR(50),    -- osm, file, api
  source_url TEXT,
  style_config JSONB,
  is_visible BOOLEAN DEFAULT true,
  opacity FLOAT DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Таблица geo_objects
```sql
CREATE TABLE geo_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id UUID REFERENCES map_layers(id),
  name VARCHAR(255) NOT NULL,
  geometry GEOMETRY NOT NULL,  -- PostGIS geometry
  properties JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Индексы для пространственных запросов
  CONSTRAINT enforce_dims CHECK (ST_NDims(geometry) = 2),
  CONSTRAINT enforce_srid CHECK (ST_SRID(geometry) = 4326)
);
CREATE INDEX idx_geo_objects_geometry ON geo_objects USING GIST (geometry);
```

### Таблица criteria
```sql
CREATE TABLE criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(20) NOT NULL,  -- benefit, cost
  unit VARCHAR(50),
  min_value FLOAT,
  max_value FLOAT,
  weight FLOAT DEFAULT 0.0,
  normalization_method VARCHAR(20) DEFAULT 'min-max',
  group_id UUID REFERENCES criterion_groups(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Таблица alternatives
```sql
CREATE TABLE alternatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  geometry GEOMETRY,  -- опционально, для привязки к карте
  properties JSONB,   -- значения критериев
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Таблица decision_matrices
```sql
CREATE TABLE decision_matrices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  algorithm VARCHAR(50) NOT NULL,  -- ahp, topsis, wsm, electre, promethee
  criteria_ids UUID[],
  alternative_ids UUID[],
  weights JSONB,
  results JSONB,
  status VARCHAR(20) DEFAULT 'draft',  -- draft, calculating, completed, error
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Таблицы проекта и POI

Полные определения: [database-schema.md](./database-schema.md) — `projects`, `project_distance_defaults`, `project_cost_rates` (`rate_thousand_rub`), `points_of_interest` (`production_per_well`, `wells_per_pad`, `extended_params`, 5 инженерных полей, 9 порогов), `poi_infrastructure_analysis`, `one_pagers` (`poi_id`).

### Таблица infrastructure_layers
```sql
CREATE TABLE infrastructure_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  name VARCHAR(255) NOT NULL,
  layer_type VARCHAR(50) NOT NULL CHECK (layer_type IN ('road', 'pipeline', 'area_facility', 'electricity')),
  source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('corporate_api', 'csv_import', 'manual')),
  map_layer_id UUID REFERENCES map_layers(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Таблица infrastructure_objects
```sql
CREATE TABLE infrastructure_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id UUID NOT NULL REFERENCES infrastructure_layers(id),
  name VARCHAR(255) NOT NULL,
  geometry GEOMETRY NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('road', 'pipeline', 'area_facility', 'electricity')),
  subtype VARCHAR(50) NOT NULL CHECK (subtype IN ('autoroad', 'oil_pipeline', 'water_pipeline', 'refinery', 'gas_processing', 'power_line', 'gtes', 'substation')),
  properties JSONB DEFAULT '{}',
  is_auto_classified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT enforce_io_srid CHECK (ST_SRID(geometry) = 4326)
);
CREATE INDEX idx_infrastructure_objects_layer_id ON infrastructure_objects(layer_id);
CREATE INDEX idx_infrastructure_objects_subtype ON infrastructure_objects(subtype);
CREATE INDEX idx_infrastructure_objects_geometry ON infrastructure_objects USING GIST (geometry);
```

### Таблица poi_infrastructure_analysis

Полное определение с `anchor_type`, `anchor_geometry`, `distance_method` — [database-schema.md](./database-schema.md).

### Таблица implementation_variants
```sql
CREATE TABLE implementation_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  poi_id UUID NOT NULL REFERENCES points_of_interest(id) ON DELETE CASCADE,
  matrix_id UUID REFERENCES decision_matrices(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  variant_type VARCHAR(20) NOT NULL DEFAULT 'base' CHECK (variant_type IN ('base')),
  -- инженерные параметры берутся из POI; здесь только факт применённой конфигурации (snapshot)
  applied_params JSONB NOT NULL DEFAULT '{}',
  -- стоимость
  engineering_equipment_cost DECIMAL(15, 2) DEFAULT 0,
  total_cost DECIMAL(15, 2) DEFAULT 0,
  -- общий статус (наихудший среди активных подтипов)
  overall_status VARCHAR(20) DEFAULT 'within_limit' CHECK (overall_status IN ('within_limit', 'exceeds_limit', 'construction_required', 'not_required')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
  subtype VARCHAR(50) NOT NULL CHECK (subtype IN ('autoroad', 'oil_pipeline', 'water_pipeline', 'refinery', 'gas_processing', 'power_line', 'gtes', 'substation')),
  distance_km DECIMAL(10, 2),
  status VARCHAR(20) NOT NULL CHECK (status IN ('within_limit', 'exceeds_limit', 'construction_required', 'not_required')),
  object_id UUID REFERENCES infrastructure_objects(id) ON DELETE SET NULL,
  calculated_cost DECIMAL(15, 2) DEFAULT 0,
  UNIQUE(variant_id, subtype)
);
CREATE INDEX idx_variant_items_variant_id ON variant_infrastructure_items(variant_id);
CREATE INDEX idx_variant_items_subtype ON variant_infrastructure_items(subtype);
```

### Таблица variant_cost_overrides (ручные корректировки стоимости по подтипу)
```sql
CREATE TABLE variant_cost_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES implementation_variants(id) ON DELETE CASCADE,
  subtype VARCHAR(50) NOT NULL CHECK (subtype IN ('autoroad', 'oil_pipeline', 'water_pipeline', 'refinery', 'gas_processing', 'power_line', 'gtes', 'substation')),
  manual_cost DECIMAL(15, 2) NOT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(variant_id, subtype)
);
CREATE INDEX idx_cost_overrides_variant_id ON variant_cost_overrides(variant_id);
```

### Таблица one_pagers
```sql
CREATE TABLE one_pagers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  poi_id UUID NOT NULL REFERENCES points_of_interest(id),
  variant_id UUID NOT NULL REFERENCES implementation_variants(id),
  title VARCHAR(255) NOT NULL,
  coordinates VARCHAR(100),
  engineer_name VARCHAR(255),
  report_date DATE DEFAULT CURRENT_DATE,
  final_variant_data JSONB NOT NULL DEFAULT '{}',
  engineering_params JSONB NOT NULL DEFAULT '{}',
  roadmap JSONB NOT NULL DEFAULT '[{"stage": "Разведка", "duration_months": 6}, {"stage": "Изыскания", "duration_months": 12}, {"stage": "ПИР", "duration_months": 18}, {"stage": "Бурение", "duration_months": 24}, {"stage": "Строительство", "duration_months": 36}, {"stage": "Эксплуатация", "duration_months": null}]',
  recommendation_text TEXT,
  is_recommendation_edited BOOLEAN DEFAULT false,
  pdf_file_path VARCHAR(500),
  pptx_file_path VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_one_pagers_project_id ON one_pagers(project_id);
CREATE INDEX idx_one_pagers_poi_id ON one_pagers(poi_id);
```

---

## Безопасность

### Аутентификация
- JWT access token (15 мин)
- Refresh token (7 дней, httpOnly cookie)
- Ролевая модель (Admin, Analyst, Viewer, Data Manager)

### Авторизация
- Guards для защиты endpoints
- Проверка прав на уровне ресурсов (user_id match)

### Валидация данных
- Pydantic schemas (request/response)
- Sanitization входных данных
- SQL injection prevention (SQLAlchemy parameterized queries)

### CORS
- Whitelist доменов
- Настройка credentials

---

## Масштабирование (MVP)

### Кеширование
- In-memory / Redis cache (опционально, `functools` или Redis на уровне FastAPI)
- CDN для статики (опционально при деплое)

### Асинхронные задачи
- Celery + Redis (фоновый импорт, генерация PDF/PPTX)
- Worker процессы для импорта

---

## Мониторинг (MVP)

- **Логи**: structlog / стандартный logging Python (JSON при необходимости)
- **Uptime**: Health check endpoints (`/health`, `/health/db`)
- **Трассировка**: OpenTelemetry (опционально, post-MVP)
