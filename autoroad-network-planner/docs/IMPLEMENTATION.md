# Implementation reference

Current behaviour of the Steiner network planner as of the GeoSteiner connectivity fix and shared post-processing pipeline.

## Architecture

```
PlanRequest
    │
    ├─► LocalProjection (WGS84 → local metres)
    │
    ├─► Solver (SteinerPy or GeoSteiner)
    │       └── SteinerTreeResult (terminals + steiner:*)
    │
    └─► Post-processing pipeline (see below)
            └── PlanResponse (WGS84 edges + terminal rows)
```

Both endpoints share the same request schema (`PlanRequest`) and most post-processing steps. Only GeoSteiner runs `_ensure_tree_connected` before the shared steps.

## Solvers

### SteinerPy (`POST /v1/plan/steinerpy`)

- Builds a **candidate graph**: terminals, geometric centroid, optional attachment rings, optional GeoSteiner Steiner points.
- Solves a Steiner tree MIP with **HiGHS** via [SteinerPy](https://github.com/berendmarkhorst/SteinerPy).
- Always returns a **single connected** tree on the candidate graph.
- Supports **attachment limits**, **angle penalty**, and **steiner_radius** filtering inside the candidate graph.

When GeoSteiner binaries are installed, SteinerPy automatically adds GeoSteiner Steiner points as extra MIP candidates (unless `steiner_candidates` is passed explicitly).

### GeoSteiner (`POST /v1/plan/geosteiner`)

- Calls native `efst | bb` for an **exact** Euclidean Steiner tree certificate.
- Does **not** natively enforce attachment limits, leaf normalization, exclusion zones, or angle preferences.
- For **n ≥ ~11–13** terminals, the certificate can occasionally describe **several disconnected FST components** with correct Steiner point coordinates but wrong global topology.

Mitigations inside the service:

1. **`_tree_from_certificate_edges`** — if a terminal is missing from certificate edges, connect it to the nearest existing node.
2. **`_ensure_tree_connected`** — if multiple components remain, rebuild topology via SteinerPy using the GeoSteiner Steiner points as candidates; fallback: shortest bridge edges between components.

## Post-processing pipeline

Order is fixed in `src/network_planner/plan/pipeline.py`.

### GeoSteiner only

| Step | Function | Purpose |
|------|----------|---------|
| 1 | `solve_steiner_tree_geosteiner` | Exact SMT; may apply `normalize_terminal_leaves` inside solver |
| 2 | `_ensure_tree_connected` | Force one component (SteinerPy rebuild preferred) |
| 3 | `_apply_steiner_radius` | Repel Steiner points outside exclusion zones |
| 4 | `_apply_constrained_fallback` | Shorten terminal attachments via `steiner:attach:*` |
| 5 | `_ensure_terminal_leaves` | Re-apply hub insertion (`steiner:hub:*`) |
| 6 | `_append_attachment_warnings` | Report remaining limit violations |
| 7 | `_apply_postprocess` | Subdivide edges (`steiner:waypoint:*`) |
| 8 | `_response_from_tree` | WGS84 output; check `start`↔`end` connectivity |

### SteinerPy

Same as GeoSteiner from step 3 onward (no `_ensure_tree_connected` — SteinerPy output is already connected).

## Node ID conventions

| Prefix | Role | Created by |
|--------|------|------------|
| `terminal:{uuid}` | Input terminal | Request |
| `steiner:0`, `steiner:1`, … | True Steiner point from solver | GeoSteiner / SteinerPy |
| `steiner:hub:*` | Hub on terminal leaf edge | `normalize_terminal_leaves` when `normalize_terminal_leaves=true` |
| `steiner:attach:*` | Point on backbone within attachment limit | `apply_attachment_limits` |
| `steiner:waypoint:*` | Intermediate vertex on a long edge | `subdivide_tree_edges` when `edge_vertex_spacing_km > 0` |

**Leaf rule:** every terminal must have graph degree 1. Hubs and attach points are allowed inside the terminal exclusion radius (`steiner_radius_km`); true Steiner points are repelled to the zone boundary.

## Options reference

| Option | Default | SteinerPy | GeoSteiner | Notes |
|--------|---------|-----------|------------|-------|
| `connector_max_km` | 0.2 | limits in candidate graph + post-process | post-process only | Per-terminal override: `terminals[].attachment_max_km` |
| `enforce_attachment_radius` | true | on/off | on/off | `false` → pure SMT, no limits |
| `normalize_terminal_leaves` | true | solver + post-process | solver + post-process | Inserts `steiner:hub:*` |
| `steiner_hub_prefix` | `steiner:hub` | yes | yes | Hub id prefix |
| `steiner_hub_offset_km` | 0 | yes | yes | Terminal→hub edge length; `0` = hub at terminal coords |
| `edge_vertex_spacing_km` | 0 | post-process | post-process | Max segment length; adds waypoints |
| `attachment_angle_deg` | 90 | candidate graph weights | ignored | Target angle at backbone |
| `attachment_angle_penalty` | 0 | candidate graph weights | ignored | `0` disables penalty |
| `steiner_radius_km` | 0 | filter candidates + repel | repel only | Exclusion disc around each terminal |
| `max_points` | 50 | request validation | request validation | Max terminals per request |

### Attachment limits

- `connector_max_km` caps the **full leaf path** from terminal to backbone (including terminal→hub when a hub exists).
- When the raw solver tree violates limits, `apply_attachment_limits` inserts `steiner:attach:*` on the backbone and reconnects the terminal.
- If limits still cannot be satisfied, warning `solver_fallback:constrained_star` is added (star-like constrained tree attempted internally).

### Steiner exclusion radius (`steiner_radius_km`)

- **Intent:** forbid placing true Steiner points closer than R to any terminal.
- **SteinerPy:** candidates inside R are removed from the MIP graph; post-process repel is also applied.
- **GeoSteiner:** post-process only — `repel_steiner_points` iteratively pushes `steiner:*` to the disc boundary.
- **Skipped prefixes:** `steiner:hub`, `steiner:attach` (bridge nodes stay near the terminal).
- Warning `{solver}_steiner_radius_vs_attachment_conflict` when R > `connector_max_km` and limits are enforced.

### Angle penalty (SteinerPy only)

Edge weights in the candidate graph are multiplied by a factor derived from the angle between the terminal→backbone direction and `attachment_angle_deg`. Higher `attachment_angle_penalty` pushes attachments toward the target (default 90°).

## Warnings

| Warning | Meaning |
|---------|---------|
| `solver:steinerpy` / `solver:geosteiner` | Which endpoint was used |
| `{solver}_disconnected_components_fixed` | GeoSteiner returned multiple components; topology was repaired |
| `{solver}_attachment_radius_violation` | Raw solver output exceeded attachment limits; post-process adjusted |
| `{solver}_steiner_radius_repel` | At least one Steiner point was moved by exclusion-radius repel |
| `{solver}_steiner_radius_vs_attachment_conflict` | R and connector limit are inconsistent |
| `attachment_radius_violations:N` | N terminals still exceed limits after all adjustments |
| `solver_fallback:constrained_star` | Attachment limits could not be fully satisfied |
| `terminal_degree_violation` | A terminal does not have degree 1 after normalization |
| `start_end_not_connected` | No path between `start` and `end` in final tree |

## GeoSteiner connectivity (n ≥ 13)

Observed behaviour on dense Moscow-area terminal sets:

- GeoSteiner finds optimal Steiner point **coordinates** but may return **3+ disconnected FST subgraphs**.
- SteinerPy on the same points produces one tree with the **same total length** (~46 km vs ~54 km with naive bridge edges).
- `_ensure_tree_connected` prefers SteinerPy rebuild (`steiner_candidates=tree`) over adding direct bridge edges.

Requires SteinerPy installed for the preferred repair path.

## Interactive prototype

`examples/planner_prototype.html` — map UI served at `/examples/planner_prototype.html`.

- Solver selector: SteinerPy / GeoSteiner.
- Parameters filtered by `data-scope`: `both`, `steinerpy`, `geosteiner`.
- Node colours: green = `steiner:*`, yellow = hub, orange = attach, grey = waypoint.

## Source layout

```
src/network_planner/
  api/routes.py              HTTP endpoints
  plan/pipeline.py           Orchestration + post-processing
  schemas/io.py              PlanRequest / PlanResponse
  steiner/
    geosteiner/              efst|bb runner + certificate parser
    steinerpy/               candidate graph + HiGHS MIP
    steiner_radius.py        repel_steiner_points
    terminal_attach.py       attachment limit enforcement
    subdivide.py             edge waypoint insertion
    validate.py              normalize_terminal_leaves
    constrained_star.py      fallback when limits impossible
tests/
  test_steiner_radius.py
  test_tree_connectivity.py
  ...
```

## Tests

```bash
pytest
```

Key coverage: Steiner radius repel, `_ensure_tree_connected`, attachment limits, API integration.
