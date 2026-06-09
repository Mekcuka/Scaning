# Экспорт данных проекта

**Дата:** июнь 2026  
**Маршрут:** `/export`  
**Связанные документы:** [user-flows.md](../product/user-flows.md) §2.3, [import через GeoJSON](map-objects-and-spatial-calculations.md), [implementation-status.md](../planning/implementation-status.md)

---

## 1. Назначение

Страница **«Экспорт»** выгружает инфраструктуру **активного проекта** (объекты `infrastructure_objects`, не POI) в табличные форматы и GeoJSON для обмена с другими системами или повторного импорта.

Реализация **клиентская**: данные запрашиваются через `GET /projects/{id}/infrastructure/objects`, файлы формируются в браузере (`frontend/src/lib/projectExport/`). Отдельного backend-маршрута `POST /api/export/geojson` нет.

---

## 2. Доступ

| Кто | Видит раздел | Может скачивать |
|-----|--------------|-----------------|
| admin, analyst, data_manager, viewer | да | да |

Настройка: `NAV_VISIBILITY['/export']` в `lib/permissions.ts`.

---

## 3. Выбор проекта

На странице — компактная панель **«Проект для выгрузки»** (`ExportProjectPanel`):

- заголовок и подсказка;
- выпадающий список всех доступных проектов (справа в шапке панели).

Отдельной сводки по проекту (статус, описание, POI, агрегированная статистика) **нет** — количества объектов показываются на карточках форматов ниже (см. §4).

Выбор синхронизируется с **глобальным** `currentProjectId` (Zustand) — тот же контекст, что используют карта, матрица, журнал задач в шапке. **Селектора проекта в шапке приложения нет** (с июня 2026).

---

## 4. Варианты выгрузки

| Карточка | Содержимое | Форматы |
|----------|------------|---------|
| **Координаты точечных объектов** | инфраструктура с подтипами из `POINT_SUBTYPES` (узлы, ГКС, подстанции и т.д.) | Excel (`.xlsx`), CSV |
| **GeoJSON проекта** | `FeatureCollection`: Point / LineString, `properties.name`, `properties.subtype` | `.geojson` |
| **Координаты всех объектов** | точки + линии; для линий — начало, конец, JSON-массив вершин | Excel, CSV |

На каждой карточке — счётчик для своего формата: число точечных объектов, число всех объектов (GeoJSON) или «N точек · M линий» (все координаты). При загрузке — «Загрузка…».

После успешного скачивания — toast внизу экрана.

Имена файлов: `{имя-проекта}-{points|objects|geojson}-{YYYY-MM-DD}.{ext}` (sanitize в `sanitizeFilename.ts`).

---

## 5. Форматы

### CSV точечных объектов

Заголовок совместим с шаблоном импорта: `name,type,lat,lon,start_lat,start_lon,end_lat,end_lon`.

### CSV всех объектов

Расширенный: `id,name,type,lat,lon,start_lat,start_lon,end_lat,end_lon,coordinates` (для линий `coordinates` — JSON `[[lon,lat],…]`).

### GeoJSON

- Point: `[lon, lat]`, LineString: вершины из `getLineCoordinates()` (хранимые координаты, без display-snap).
- `properties`: `name`, `subtype` + ключи из `object.properties` (в т.ч. `render_3d_*` для re-import).

Проверка: **Импорт → Превью (dry-run)** с сохранённым `.geojson`.

---

## 6. Пустые состояния

- Нет проектов — ссылка на «Проекты».
- Проект без объектов — блок с кнопками «Открыть карту» и «Импорт данных»; кнопки выгрузки неактивны.

---

## 7. Код

| Путь | Роль |
|------|------|
| `frontend/src/pages/ExportPage.tsx` | UI страницы |
| `frontend/src/pages/export/useExportPage.ts` | загрузка infra, обработчики |
| `frontend/src/pages/export/ExportProjectPanel.tsx` | выбор проекта |
| `frontend/src/pages/export/ExportOptionCard.tsx` | карточки форматов |
| `frontend/src/lib/projectExport/geoJson.ts` | сбор GeoJSON |
| `frontend/src/lib/projectExport/coordinates.ts` | Excel/CSV |
| `frontend/src/lib/projectExport/sanitizeFilename.ts` | имена файлов |

Unit-тесты: `frontend/src/lib/projectExport/*.test.ts`.

---

## 8. Не входит в scope

- POI (`points_of_interest`) — отдельная сущность.
- Backend batch export — post-MVP при очень больших проектах.
- Полный Excel матрицы / одностраничника — см. [development-plan.md](../planning/development-plan.md) этап 5.
