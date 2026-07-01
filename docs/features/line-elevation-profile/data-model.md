# Модель данных: line-elevation-profile

## Хранение профилей (per line object)

| Где | Поле | Тип | Описание |
|-----|------|-----|----------|
| InfrastructureObject.properties | `line_elevation_profile_step_m` | number | Шаг сэмплинга, м (10–1000, default 100) |
| InfrastructureObject.properties | `line_elevation_profile_json` | JSON | Профиль (points + meta) |
| InfrastructureObject.properties | `line_elevation_profile_computed_at` | string | ISO timestamp |

### `line_elevation_profile_json`

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

## Хранение ЦМР (per project) — только последний

Таблица `project_line_dem`:

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | UUID PK | |
| project_id | UUID UNIQUE FK | один ЦМР на проект |
| bbox_hash | string(16) | |
| bbox_west/south/east/north | float | |
| source | string(64) | |
| file_size_bytes | int | |
| fetched_at | timestamptz | |

Файл: `{LINE_PROFILE_DEM_DATA_ROOT}/{project_id}/dem.tif`

При новой выгрузке: upsert строки, перезапись/удаление старого `.tif`.

## Миграция

Alembic `027_project_line_dem` — создание таблицы `project_line_dem`.
