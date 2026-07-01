# План: высотный профиль линейных объектов

**Дата:** 2026-07-01  
**Статус:** реализовано (Builder ✅, Reviewer ✅)

## Цель и границы

### В scope
- Ручной расчёт по кнопке «Рассчитать профиль»
- BBOX по всем infra-объектам проекта (кроме забоев) → один ЦМР на проект
- Сэмплинг высот вдоль polyline линейных объектов (шаг 100 м, override per-object)
- Вкладка «Профиль» в панели параметров — таблица + экспорт Excel
- Хранение только последнего ЦМР в `project_line_dem`

### Вне scope (post-MVP)
- График профиля (chart)
- Отдельный микросервис
- Профиль для `well_bottomhole_gs`

## Стек

| Компонент | Выбор |
|-----------|-------|
| Расчёт | In-process BFF, rasterio + OpenTopography |
| Микросервис | Не требуется |
| Хранение ЦМР | Таблица `project_line_dem` + один `.tif` на проект |
| Профили линий | `InfrastructureObject.properties` |
| Фон | In-process BFF; при Redis/ARQ — job `line_elevation_profile_compute` |

## Фазы

1. Backend: polyline resample, project DEM repository, compute API
2. Frontend: вкладка «Профиль», кнопка в меню «Расчёт»
3. Тесты + CI

## Критерии готовности

- [x] Контракт из contract.md реализован 1:1
- [x] pytest + npm run test зелёные
- [x] В БД не более одной записи ЦМР на проект
- [x] Bottomholes исключены из BBOX
