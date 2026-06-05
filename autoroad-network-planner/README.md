# Steiner Network Planner

Python microservice that builds a **Euclidean Steiner tree** over map **terminals**. **Start** and **end** of the network are terminals with roles `start` and `end`; other objects use `intermediate`.

Calculation is done by external solvers only: **SteinerPy** (pip) or **GeoSteiner** (native binaries).

**Documentation**

| Document | Contents |
|----------|----------|
| [docs/MICROSERVICE.md](docs/MICROSERVICE.md) | Deploy (Docker Compose), env, probes, logging |
| [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) | Architecture, post-processing pipeline, node IDs, warnings, source layout |
| [docs/PARAMETERS.ru.md](docs/PARAMETERS.ru.md) | Parameter reference (RU): solver-specific behaviour, recommended settings |

## Model

| Layer | Points | Connection |
|-------|--------|------------|
| `steiner_tree` | all `terminals` + optional `steiner:*` | SMT; each terminal is a leaf (one incident edge) |
| `terminals` | result rows | `role`, `via: tree`, `attached_to` = neighbor on the tree |

Terminal IDs appear in `steiner_tree.edges` as `terminal:{uuid}`.

### Node types in `steiner_tree`

| ID pattern | Role |
|------------|------|
| `terminal:{uuid}` | Input terminal |
| `steiner:0`, … | Steiner point from solver |
| `steiner:hub:*` | Hub inserted so terminal has degree 1 |
| `steiner:attach:*` | Attachment point within connector limit |
| `steiner:waypoint:*` | Subdivision vertex on a long edge |

## Quick start

```bash
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -e ".[dev,steinerpy]"
uvicorn network_planner.api:app --reload --port 8080
```

Health: `GET http://localhost:8080/health`  
Readiness: `GET http://localhost:8080/ready`  
SteinerPy plan: `POST http://localhost:8080/v1/plan/steinerpy`  
GeoSteiner plan: `POST http://localhost:8080/v1/plan/geosteiner`

Check availability: `GET /v1/steinerpy/status`, `GET /v1/geosteiner/status`

## Request example

```json
{
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "terminals": [
    { "id": "11111111-1111-1111-1111-111111111101", "type": "oil_pad", "role": "start", "lon": 37.60, "lat": 55.75 },
    { "id": "22222222-2222-2222-2222-222222222201", "type": "oil_pad", "role": "intermediate", "lon": 37.62, "lat": 55.76 },
    { "id": "11111111-1111-1111-1111-111111111102", "type": "gas_processing", "role": "end", "lon": 37.64, "lat": 55.74 }
  ],
  "options": {
    "connector_max_km": 0.2,
    "max_points": 50
  }
}
```

Exactly one terminal with `role: "start"` and one with `role: "end"` is required.

### Options (summary)

| Field | SteinerPy | GeoSteiner | Description |
|-------|-----------|------------|-------------|
| `connector_max_km` | graph + post | post | Max terminal leaf-edge length (km) |
| `enforce_attachment_radius` | yes | yes | `false` = pure SMT |
| `normalize_terminal_leaves` | yes | yes | Insert hub nodes (degree 1) |
| `steiner_hub_prefix` | yes | yes | Hub id prefix |
| `steiner_hub_offset_km` | yes | yes | Terminal→hub edge length (km) |
| `edge_vertex_spacing_km` | post | post | Subdivide edges with waypoints |
| `attachment_angle_deg` | yes | — | Target attachment angle (°) |
| `attachment_angle_penalty` | yes | — | Angle deviation weight; `0` = off |
| `steiner_radius_km` | filter + repel | repel | Exclusion zone around terminals |
| `terminals[].attachment_max_km` | yes | yes | Per-terminal connector override |

Full details: [docs/PARAMETERS.ru.md](docs/PARAMETERS.ru.md).

`connector_max_km` limits the **full leaf path** from terminal to backbone (including terminal→hub). When limits are violated, the tree is adjusted in post-processing (attach nodes); warnings are returned instead of silent replanning.

## Post-processing pipeline

Both solvers share the same post-processing after the initial tree is built (`src/network_planner/plan/pipeline.py`):

```
GeoSteiner:  solve → ensure_connected → steiner_radius → attachment_limits → normalize_leaves → subdivide → response
SteinerPy:   solve → steiner_radius → attachment_limits → normalize_leaves → subdivide → response
```

GeoSteiner-only: if the certificate has multiple disconnected components (observed for n ≥ ~13), `_ensure_tree_connected` rebuilds topology via SteinerPy using the same Steiner points.

## Response (outline)

- `steiner_tree` — tree over terminals (`steiner_points`, `edges`)
- `terminals` — every object with `role`, `via`, `attached_to`, `length_m`
- `warnings` — see [docs/IMPLEMENTATION.md#warnings](docs/IMPLEMENTATION.md#warnings)
- `total_length_m` — tree length
- `solver` — `"steinerpy"` or `"geosteiner"`

## Solvers

### SteinerPy (pip)

[SteinerPy](https://github.com/berendmarkhorst/SteinerPy) solves a Steiner tree MIP on a candidate graph (terminals + centroid + optional GeoSteiner Steiner points) using HiGHS.

```bash
pip install steinerpy
# or: pip install -e ".[steinerpy]"
```

`POST /v1/plan/steinerpy` — response includes `"solver": "steinerpy"`.

Optimal on the candidate graph; always connected. Supports attachment limits, angle penalty, and steiner-radius filtering in the graph.

When GeoSteiner is installed, SteinerPy uses its Steiner points as extra MIP candidates.

### GeoSteiner (exact, optional)

[GeoSteiner](https://geosteiner.net/) computes **optimal** Euclidean Steiner trees via native binaries `efst` and `bb`.

Build (Linux/macOS):

```bash
bash scripts/build_geosteiner.sh
```

Windows (MSYS2 + MinGW):

```powershell
winget install MSYS2.MSYS2
powershell -ExecutionPolicy Bypass -File scripts/build_geosteiner.ps1
```

Binaries land in `vendor/geosteiner/bin` (auto-detected). On Windows, MSYS2 `C:\msys64\mingw64\bin` must be present for runtime DLLs.

`POST /v1/plan/geosteiner` — response includes `"solver": "geosteiner"`.

GeoSteiner is licensed under [CC BY-NC 4.0](https://geosteiner.net/) (non-commercial). Built artifacts live under `vendor/geosteiner/` (not committed by default).

For large terminal counts, install SteinerPy as well — it is used to repair disconnected GeoSteiner certificates while keeping the same Steiner point coordinates.

## Demo by terminal count

```bash
python scripts/demo_terminal_counts.py
```

Writes `examples/by_terminal_count/summary.json` (zigzag: first=start, last=end). Requires SteinerPy or GeoSteiner.

## Tests

```bash
pytest
```

## Deploy as microservice

```bash
cp .env.example .env
docker compose up --build
```

SteinerPy is included in the image. GeoSteiner is optional via volume mount — see [docs/MICROSERVICE.md](docs/MICROSERVICE.md).

## Docker (single container)

```bash
docker build -t network-planner .
docker run -p 8080:8080 --env-file .env network-planner
```

## API docs

OpenAPI UI: `http://localhost:8080/docs`

Interactive prototype: `http://localhost:8080/examples/planner_prototype.html` — solver-specific parameter panels, coloured node types (Steiner / hub / attach / waypoint).
