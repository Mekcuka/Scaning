# Контракт API: line-elevation-profile

## BFF (монолит)

### POST /api/v1/projects/{project_id}/infrastructure/line-elevation-profile/compute

**Auth:** infra write  
**Request:** `{}` (empty body)

**Response 200:**
```json
{
  "computed_count": 5,
  "dem_fetched": true,
  "dem_reused": false,
  "errors": []
}
```

**Response 400:**
- `line_elevation_profile_no_objects` — нет объектов для BBOX
- `line_elevation_profile_no_lines` — нет линейных объектов для профиля

**Response 502/503:** коды DEM из pad-earthwork (`dem_api_not_configured`, `dem_fetch_failed`, …)

---

### GET /api/v1/projects/{project_id}/infrastructure/objects/{object_id}/line-elevation-profile

**Auth:** infra read

**Response 200:**
```json
{
  "step_m": 100,
  "computed_at": "2026-07-01T12:00:00Z",
  "dem_source": "opentopography:COP30",
  "total_length_m": 1234.5,
  "points": [
    { "chainage_m": 0, "lon": 37.1, "lat": 55.2, "elevation_m": 142.3 }
  ]
}
```

**Response 404:** `line_elevation_profile_not_found`

---

## Properties (InfrastructureObject)

| Ключ | Тип | Описание |
|------|-----|----------|
| `line_elevation_profile_step_m` | number | Шаг, м (default 100) |
| `line_elevation_profile_json` | object | Результат расчёта (см. data-model.md) |
| `line_elevation_profile_computed_at` | string ISO | Время последнего расчёта для объекта |
