# impl-log: line-elevation-profile

**Дата:** 2026-07-01  
**Роль:** Builder

## Backend

- Сервис `app/services/line_elevation_profile/`:
  - `polyline_sample.py` — сэмплинг вдоль polyline по chainage (haversine)
  - `bbox.py` — BBOX по видимым infra без `BOTTOMHOLE_CLUSTER_SUBTYPES`
  - `project_dem_repository.py` — один ЦМР на проект (`project_line_dem` + `{root}/{project_id}/dem.tif`)
  - `profile_compute.py` — оркестрация: DEM → профили в `properties`
  - `api_handlers.py` + `app/api/v1/line_elevation_profile.py`
- Модель `ProjectLineDem`, миграция `027_project_line_dem`
- Роутер подключён в `app/api/v1/map.py`
- `LINE_PROFILE_DEM_DATA_ROOT` в `settings`
- Очистка DEM-файла в `project_delete.py`

## Frontend

- API: `lib/api/lineElevationProfileApi.ts`
- Утилиты: `lib/lineElevationProfile.ts` (пикет, уклон ‰)
- Вкладка `InfraDetailProfileTab` + кнопка в меню «Расчёт»
- Хук `useLineElevationProfileCompute` + инвалидация `['infra', projectId]`
- Поле `line_elevation_profile_step_m` в форме сохранения линии

## Тесты

- `test_polyline_sample.py`
- `test_line_elevation_profile_bbox.py`
- `test_project_line_dem_repository.py`
- `test_line_elevation_profile_compute.py`
- `lineElevationProfile.test.ts`
- `InfraDetailProfileTab.test.tsx`

## Заметки для Reviewer

- Профиль для `well_bottomhole_gs` исключён; остальные `LINE_SUBTYPES` — включены
- DEM переиспользуется при неизменном BBOX (`dem_reused`)
- График профиля вне scope (MVP — таблица + Excel)
- Integrator: применить миграцию `alembic upgrade head` на VM

## Заметки для Integrator

- Env: `LINE_PROFILE_DEM_DATA_ROOT` (опционально, по умолчанию `data/line_profile_dem`)
- OpenTopography: тот же `OPENTOPOGRAPHY_API_KEY`, что для pad-earthwork

## Журнал задач (2026-07-01)

- `job_type`: `line_elevation_profile_compute`
- При `jobs_async_enabled()` POST `/compute` возвращает **202** + `job_id`; воркер вызывает `compute_line_elevation_profiles`
- На SQLite (тесты) — синхронный **200**, как раньше
- Frontend: `lineElevationProfileApi.compute` через `unwrapApiJobResponse`; path в `loggablePaths.ts`; подпись «Профиль высот линий» в `jobLabels.ts`

## Документация (2026-07-01)

- [line-elevation-profile.md](line-elevation-profile.md) — пользовательская спецификация
- Wiki: `docs/wiki/articles/line-elevation-profile.md` (после правок — `python scripts/sync-assistant-wiki.py`)
- Индекс: [features/README.md](../README.md), [task-log-panel.md](../jobs/task-log-panel.md), [map-objects §1.10](../map/map-objects-and-spatial-calculations.md)
