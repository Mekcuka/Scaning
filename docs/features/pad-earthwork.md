# Земляные работы кустовой площадки

MVP-расчёт объёмов выемки/отсыпки для объектов `oil_pad` и `gas_pad` на плоской опорной отметке или по DEM (OpenTopography).

## Архитектура

```mermaid
flowchart LR
  UI[Карточка куста] --> BFF[pad_earthwork API]
  BFF --> Bridge[planner_bridge]
  Bridge -->|in-process| Planner[pad-earthwork-planner]
  Bridge -->|HTTP optional| Planner
  BFF --> Props[InfrastructureObject.properties]
```

- **Микросервис** [`pad-earthwork-planner`](../../pad-earthwork-planner/) — расчёт объёмов, footprint, mesh GLB.
- **Монолит** — BFF (`app/api/v1/pad_earthwork.py`), port/adapter (`app/services/pad_earthwork/`), кэш в `properties`.
- По умолчанию **in-process** (пакет в образе API как `pad-earthwork-vendor`). Отдельный контейнер `:8081` — только dev/нагрузочные тесты.

## Микросервис

| Endpoint | Описание |
|----------|----------|
| `GET /health` | Liveness |
| `GET /ready` | Readiness |
| `POST /v1/compute` | Расчёт объёмов: `terrain.mode=flat` (`fill_m3 = L×W×H`, `cut_m3 = 0`) или `terrain.mode=dem` (сетка cut/fill по GeoTIFF) |
| `POST /v1/sketch/preview` | Превью плана: площадь, углы в локальной ENU |
| `POST /v1/sketch/generate-from-wells` | Автогенерация `plan_polygon` по числу скважин и отступам |

`terrain.mode=dem` — cut/fill по сетке 1×1 м внутри footprint; BFF загружает GeoTIFF через [OpenTopography Global DEM API](https://opentopography.org/developers) (по умолчанию `COP30`). При Redis/ARQ `compute` с DEM может вернуть **202** + job `pad_earthwork_compute`.

**DEM (OpenTopography):**

- Env backend: `OPENTOPOGRAPHY_API_KEY`, `OPENTOPOGRAPHY_DEM_TYPE` (default `COP30`), `PAD_DEM_DATA_ROOT`, `PAD_DEM_BBOX_PADDING_M`, `PAD_DEM_MIN_BBOX_SIDE_M` (default 300 — OpenTopography требует ≥250 м на каждую сторону bbox; при повороте площадки ось-aligned bbox может быть уже footprint).
- Кэш GeoTIFF: `data/pad_dem/{project_id}/{asset_uuid}.tif`; в properties: `pad_dem_asset_id`, `pad_dem_fetched_at`, `pad_dem_source`, `pad_dem_bbox_hash`.
- UI карточки куста: переключатель «Плоская отметка / DEM», кнопки «Загрузить DEM» и «Рассчитать».
- Design surface: плоская верхняя отметка `reference_elevation_m + height_m`; выемка там, где рельеф выше, отсыпка — где ниже.
- Ограничения: envelope + DEM → warning `envelope_ignored_with_dem`; ручная загрузка GeoTIFF — **501**.

**Схема (sketch):**

Прямоугольник:

```json
{
  "sketch": { "kind": "plan_rectangle", "length_m": 120, "width_m": 80, "rotation_deg": 0 },
  "params": { "height_m": 2.5, "reference_elevation_m": 150 }
}
```

Произвольный контур (полигон, до 64 вершин в локальной ENU). Якорь зависит от способа задания — см. § UI «Якорь footprint»; для ручного полигона вершины задаются относительно `lon/lat` объекта:

```json
{
  "sketch": {
    "kind": "plan_polygon",
    "vertices": [
      { "east_m": -60, "north_m": -40 },
      { "east_m": 60, "north_m": -40 },
      { "east_m": 40, "north_m": 40 },
      { "east_m": -60, "north_m": 40 }
    ]
  },
  "params": { "height_m": 2.5, "reference_elevation_m": 150 }
}
```

Для полигона: `fill_m3 = площадь_контура × H` (формула шнурка), `footprint_corners` — вершины контура; mesh GLB — упрощённый bounding box (`polygon_mesh_is_bbox_approximation`).

**Обволование** (опционально в `compute` и в модалке «Схема…»):

```json
{
  "sketch": { "kind": "plan_polygon", "vertices": [ ... ] },
  "params": { "height_m": 2.5, "reference_elevation_m": 150 },
  "envelope": { "enabled": true, "wrap_width_m": 3 }
}
```

Параметр `wrap_width_m` = **W** — ширина подошвы песчаного «забора» на **верхней плоскости насыпи** (design elevation = `reference_elevation_m + height_m`).

### Модель обволования (вариант A — кольцо-забор)

В **UI** (план, профиль, 3D) и в **оценке объёма в модалке** используется симметричная **равнобедренная трапеция** в поперечнике; оба откоса **1:1**.

| Обозначение | Формула | Пример при W = 3 |
|-------------|---------|------------------|
| TW — ширина бровки (верх полосы) | `W / 3` | 1 м |
| H — высота откоса (1:1) | `(W − TW) / 2` | 1 м |
| S — площадь поперечного сечения полосы | `H × (W + TW) / 2` | 2 м² |
| V — объём кольца | `P × S`, P — периметр контура верха насыпи | — |

```text
Поперечник (вид с торца):

        TW
    ┌───────┐  ← бровка (+H к design)
   /         \
  /     H     \  откосы 1:1
 /             \
├─────── W ─────┤  ← подошва на design (верх насыпи)
│   площадка    │
```

**План** (контур верха насыпи = внешний край подошвы):

| Линия | Inset от контура площадки |
|-------|---------------------------|
| Внутренний край подошвы | W |
| Внешняя бровка (светлый пунктир) | H |
| Внутренняя бровка (тёмный пунктир) | `(W + TW) / 2` |

**3D:** кольцо на верху призмы — подошва на `reference + height_m`, бровка на `+ H` (не `+ W`).

**Профиль:** на торцах — трапеция с подъёмом H; при W = 3, design = 152 м: `0,152 1,153 99,153 100,152`. Доп. объём в UI: `2 × (L + B) × S` (пример L = 100, B = 40, W = 3 → **560 м³**).

**Frontend:** `padEarthworkSketch.ts` (`envelopeBerm*`, `estimateEnvelopeBermRingVolumeM3`), `profileEnvelope.ts`, `padEarthworkScene3d.ts` (`buildEnvelopeBermRing`).

### Объём в POST compute (planner, legacy)

`pad-earthwork-planner` пока считает **другую** упрощённую модель — **усечённую пирамиду** вокруг всего контура (контур смещается **наружу** на W):

- `fill_m3 = (H_pad / 3) × (A_top + A_bottom + √(A_top × A_bottom))`
- warning `envelope_volume_is_truncated_pyramid_approximation`
- `footprint_corners` на карте — **внешний** (нижний) контур; `design.footprint_area_m2` = площадь низа

Для **профиля** в planner: доп. объём `W × H_pad × (L + B)`, warning `profile_envelope_side_wrap_approximation`.

> **Известное расхождение MVP:** визуализация и оценка в модалке — вариант A (кольцо на верху насыпи); сохранённый результат **Рассчитать** — формулы planner до выравнивания backend.

`kind: "profile"` — поперечный профиль (этап 2, см. § Профиль).

## Профиль (поперечник)

План и профиль **хранятся отдельно**. Профиль задаёт линию рельефа вдоль центральной оси площадки (длина L и НДС из плана).

```json
{
  "kind": "profile",
  "width_m": 40,
  "design_elevation_m": 152,
  "chainage_points": [
    { "chainage_m": 0, "elevation_m": 150 },
    { "chainage_m": 100, "elevation_m": 151 }
  ]
}
```

- **chainage_m** — пикетаж вдоль оси, 0…L (м).
- **design_elevation_m** — проектная горизонталь (перетаскивается в редакторе).
- **width_m** — ширина полосы земляных работ (м).

Объём по сегментам: трапец. интеграция × `width_m` между рельефом и проектной отметкой (fill/cut).

При включённом **обволовании**:

| Слой | Доп. объём | Примечание |
|------|------------|------------|
| **UI / оценка в модалке** | `2 × (L + B) × S`, S = `H × (W + TW) / 2` | Торцевые трапеции на графике; бровка на `design + H` |
| **POST compute (planner)** | `W × H_pad × (L + B)` | warning `profile_envelope_side_wrap_approximation` |

Footprint на карте — из сохранённого plan-sketch или scalar params.

**DEM:** `POST …/dem/profile/sample` — съёмка высот вдоль центральной линии (шаг по умолчанию 1 м). Требует загруженный DEM (`dem/fetch`).

**Ограничения MVP:** ось только по центру прямоугольника/BBox полигона; при `terrain.mode=dem` объём считается по точкам профиля (warning `profile_volumes_use_chainage_terrain`), не по 2D-сетке.

## Монолит (BFF)

Базовый префикс: `/api/v1/projects/{project_id}/infrastructure/objects/{object_id}/pad-earthwork/`

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `compute` | Расчёт и кэш в `properties` |
| GET | `last` | Последние params, sketch, profile, `wells_local`, envelope, результат |
| PATCH | `params` | Только L/W/H/rotation/reference (без пересчёта) |
| PATCH | `sketch` | Сохранение схемы **плана**, `wells_local`, envelope и **НДС** |
| PATCH | `profile` | Сохранение профиля без пересчёта объёмов |
| POST | `sketch/generate` | Автогенерация схемы по скважинам (из `properties` или тела запроса) |
| POST | `dem/fetch` | Автозагрузка DEM по bbox footprint (OpenTopography) |
| POST | `dem/preview` | Сетка высот DEM в локальной ENU для наложения на схему площадки |
| POST | `dem/profile/sample` | Съёмка DEM вдоль центральной линии для редактора профиля |

Дополнительно:

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/projects/{id}/pad-earthwork/sketch/preview` | Превью плана без привязки к объекту |
| POST | `/projects/{id}/pad-earthwork/dem` | Ручная загрузка GeoTIFF (**501**, используйте `dem/fetch`) |

`compute` принимает опциональный `sketch` (план) или `profile` — объёмы из профиля; footprint из сохранённого plan-sketch или params. `height_m` и `reference_elevation_m` из `params`.

**Ключи `properties`:**

| Ключ | Назначение |
|------|------------|
| `pad_length_m`, `pad_width_m`, `pad_height_m` | Габариты площадки, м |
| `pad_rotation_deg` | **НДС** — азимут ряда скважин, 0…360° (см. § Автогенерация); для прямоугольника в редакторе — поворот footprint |
| `pad_reference_elevation_m` | Опорная отметка рельефа, м |
| `pad_fill_volume_m3`, `pad_cut_volume_m3` | Кэш последнего расчёта |
| `pad_earthwork_computed_at` | ISO-время расчёта |
| `pad_earthwork_sketch_json` | Последняя схема плана (`plan_rectangle` или `plan_polygon`) |
| `pad_earthwork_profile_json` | Профиль (`kind: profile`) — chainage_points, width_m, design_elevation_m |
| `pad_earthwork_profile_saved_at` | ISO-время последнего сохранения профиля |
| `pad_wells_local_json` | Позиции скважин в локальной ENU `[{east_m, north_m}, …]` (сохраняются с автогенерацией) |
| `pad_earthwork_sketch_saved_at` | ISO-время последнего сохранения схемы (без пересчёта) |
| `pad_envelope_enabled`, `pad_envelope_wrap_width_m` | Обволование: W — ширина подошвы забора на верху насыпи |
| `pad_well_count`, `pad_wells_per_group` | Скважины на кусте и в группе (режим «Генератор» в модалке схемы) |
| `pad_well_spacing_m`, `pad_well_group_spacing_m` | Шаг между скважинами в группе и между группами, м |
| `pad_layout_margin_left_m` | Отступ слева от первой скважины, м |
| `pad_layout_margin_bottom_m`, `pad_layout_margin_top_m` | Отступы вниз/вверх от линии скважин, м |
| `pad_layout_margin_end_m` | Отступ справа от последней скважины, м |
| `pad_dem_asset_id` | UUID файла DEM на диске |
| `pad_dem_fetched_at` | ISO-время последней загрузки DEM |
| `pad_dem_source` | Источник, напр. `opentopography:COP30` |

**Стандартные значения генератора** (если ключи не заданы на объекте):

| Параметр | Default |
|----------|---------|
| `pad_well_count` | 12 |
| `pad_wells_per_group` | 1 |
| `pad_well_spacing_m` | 9 |
| `pad_well_group_spacing_m` | 9 |
| `pad_layout_margin_left_m` | 27 |
| `pad_layout_margin_bottom_m` | 43 |
| `pad_layout_margin_top_m` | 15 |
| `pad_layout_margin_end_m` | 70 |
| НДС (`pad_rotation_deg` / `rotation_deg` в generate) | 90 |

**Конфиг** (`backend/.env`):

```env
PAD_EARTHWORK_INPROCESS=true
# PAD_EARTHWORK_SERVICE_URL=http://127.0.0.1:8081
```

Импорт пакета **ленивый** (`planner_bridge.py`): API стартует без установленного `pad-earthwork-planner`; ошибка — только при вызове `compute`, если пакет недоступен.

## UI

### Якорь footprint: два режима

| Режим | Когда | Якорь на карте |
|-------|--------|----------------|
| Ручной прямоугольник | `plan_rectangle` в редакторе | Геометрический центр (симметричный bbox) |
| Автогенерация / полигон | `plan_polygon` из автогенератора | **Первая скважина** `(0, 0)` = `lon/lat` объекта куста |

### Автогенерация по скважинам

1. Вкладка **«Логистика»** → **«Схема…»** — по умолчанию открывается режим **«Генератор»** (первый в переключателе формы).
2. Поля скважин, отступов контура и **НДС, °** — в правой панели модалки; **«Сгенерировать»** — `POST sketch/generate`.
3. Результат — `plan_polygon` (4 вершины) + маркеры скважин на холсте; L/W и НДС подставляются в поля карточки.
4. **Сохранить** в модалке — контур в `pad_earthwork_sketch_json`, скважины в `pad_wells_local_json`, НДС в `pad_rotation_deg`.
5. **Сохранить** на карточке объекта — параметры скважин и отступов в `pad_well_*` / `pad_layout_margin_*`.

При переключении **Генератор** ↔ **Произвольная** ↔ **Прямоугольник** сгенерированный контур и скважины сохраняются в сессии модалки; при возврате в **Генератор** восстанавливаются из снимка (если был переход через «Прямоугольник», bbox не затирает исходный полигон).

**Геометрия:** скважины в один ряд; ориентация ряда задаётся **НДС**; между группами — `pad_well_group_spacing_m`; контур: слева от первой, вниз/вверх от линии, справа от последней.

**Запрос `sketch/generate` (тело опционально; пустое `{}` — defaults из таблицы выше или из `properties` объекта):**

```json
{
  "well_count": 12,
  "wells_per_group": 1,
  "well_spacing_m": 9,
  "group_spacing_m": 9,
  "margins": { "left_m": 27, "bottom_m": 43, "top_m": 15, "end_m": 70 },
  "rotation_deg": 90
}
```

**НДС** (`rotation_deg` / `pad_rotation_deg`): азимут ряда скважин от первой к последней, **0…360°** по часовой от **севера** (0° = север, 90° = восток, **180° = юг**, ряд сверху вниз на плане). По умолчанию **90°**.

**Ответ generate:** `sketch` (`plan_polygon`), `wells_local`, `length_m`, `width_m`, `rotation_deg`, `footprint_area_m2`.

**Тело PATCH `sketch` (фрагмент):**

```json
{
  "sketch": { "kind": "plan_polygon", "vertices": [ ... ] },
  "params": { "height_m": 2.5, "reference_elevation_m": 150 },
  "wells_local": [{ "east_m": 0, "north_m": 0 }, ...],
  "rotation_deg": 90,
  "envelope": { "enabled": false, "wrap_width_m": 3 }
}
```

**Ответ GET `last`:** `params`, `sketch`, `wells_local`, `envelope`, `sketch_saved_at`, `result`.

**Модуль planner:** `well_layout.py` — `compute_well_positions_east_m`, `generate_pad_polygon_from_wells`.

Вкладка **«Логистика»** карточки `oil_pad` / `gas_pad`:

- поля L×W×H, опорная отметка, **НДС, °** (на карточке — тот же смысл, что в генераторе);
- **Схема…** — модальное окно с SVG-редактором (вид сверху, локальная ENU; якорь — см. таблицу выше);
  - переключатель: **Генератор** (по умолчанию) / **Произвольная** / **Прямоугольник**;
  - режим **«Генератор»** — параметры скважин, отступы, НДС и **«Сгенерировать»** (панель справа);
- **Обволование** — toggle + ширина основания W; песчаный «забор» по контуру **верха насыпи** (подошва W на design, откосы 1:1, высота H = (W − TW)/2, TW = W/3); на плане — кольцо подошвы + две бровки; в 3D — кольцо на верху призмы; на профиле — торцевая трапеция;
- вкладка **«3D»** — интерактивная сцена Three.js: рельеф из `POST dem/preview` (сетка ≤128×128), призма площадки по контуру плана, обволование как кольцо-забор (трапеция в поперечнике); без DEM — плоскость на опорной отметке; орбитальная камера, «Вписать»;
- вкладка «Профиль» — поперечник вдоль центральной линии;
- **Рассчитать** — POST `compute` (из полей или из модалки со `sketch`);
- **Сохранить** (в модалке) — PATCH `sketch`: контур, `wells_local`, envelope и НДС в `properties`; объёмы не пересчитываются;
- **Применить к полям** (в модалке) — синхронизация L/W/rotation в поля карточки без сохранения на сервер и **без закрытия** модалки;
- **Применить N м³ к спросу песка** — заполняет `sand_volume_m3` в черновике (сохранение — кнопкой карточки).

Подсказка в UI: «упрощённый расчёт на плоской опорной отметке»; для автогенерации — «точка на карте = первая скважина (0,0)».

### Редактор схемы (модалка)

Переключатель формы: **Генератор** / **Произвольная** / **Прямоугольник** (по умолчанию открывается **Генератор**). В режиме **Генератор** — форма параметров скважин и отступов, кнопка **«Сгенерировать»** (`sketch/generate`), предпросмотр контура (read-only) и маркеры скважин. Общие элементы холста: оси E/N, стрелка севера, маркер якоря `(0,0)` (первая скважина при автогенерации; геом. центр при симметричном прямоугольнике), **маркеры скважин** (оранжевые, при автогенерации), сетка 1 м (toggle), масштаб и «Вписать», площадь контура в центре (для замкнутого полигона), периметр в подсказке.

| Элемент | Описание |
|---------|----------|
| **Сетка 1 м** | Привязка вершин и размеров к шагу 1 м (toggle в тулбаре) |
| **Длины** | Подписи длин сторон на рёбрах (toggle, по умолчанию вкл.; общий для прямоугольника и полигона) |
| **Zoom / Вписать** | Масштаб холста; при перетаскивании вершин/рёбер viewport не «прыгает» (заморозка bbox) |
| **Рельеф DEM** | Toggle: hillshade + подсветка насыпи (синий) / выемки (оранжевый) внутри контура; `POST dem/preview` (сетка ≤128×128 в локальной ENU). Если DEM не загружен — кнопка «Загрузить DEM» в тулбаре (`dem/fetch`). Легенда в sidebar: min/max рельеф, верх площадки |
| **3D** | Обволование — кольцо-забор на верху призмы: подошва W на design, откосы 1:1, бровка на высоте H = (W−TW)/2 |
| **Обволование (план)** | Кольцо подошвы (ширина W) + пунктир **внешней** и **внутренней** бровки (inset H и (W+TW)/2) |

**DEM overlay:** canvas-подложка под SVG; пересчёт с debounce ~400 ms при изменении контура или высоты/отметки. Включён по умолчанию, если в карточке выбран режим DEM и `pad_dem_asset_id` задан.

**Прямоугольник** (`PlanRectangleEditor`):

| Инструмент | Действие |
|------------|----------|
| Углы | Перетаскивание углов от центра; опционально **Пропорции** (lock aspect) |
| Стороны | Перетаскивание середины стороны — изменение длины или ширины |
| Поворот | Маркер поворота вокруг центра |
| Пресеты | Типовые L×W; «Разбить в полигон»; сброс |

На рёбрах при включённом **Длины** — подписи `ширина м` / `длина м` у середин сторон.

**Произвольный контур** (`PlanPolygonEditor`, до 64 вершин, минимум 3 для расчёта):

| Инструмент | Действие |
|------------|----------|
| Рисовать | Клик по холсту — добавление вершины (один клик = одна вершина); предпросмотр последнего ребра |
| Вершины | Перетаскивание вершин; **перетаскивание стороны** — параллельный перенос ребра (обе смежные вершины); hit zone 14 px на рёбрах |
| Вставить | Один клик по стороне контура — вставка вершины на ребре (проекция на отрезок) |
| Удалить | Клик по вершине (не менее 3 вершин) |

При включённом **Длины** — подписи длины каждого ребра в метрах (смещение наружу от центра масс контура). Формат: целые или одна десятая (`12 м`, `12,3 м`).

Пресеты контура: «Из прямоугольника», «Очистить», сброс. Индикатор сохранённой схемы на вкладке «Логистика» (`pad_earthwork_sketch_saved_at`).

**Frontend:** `components/padEarthwork/` (`PadEarthworkSketchModal`, `PadEarthworkScene3D`, `EnvelopePlanLegend`, `DemPlanBackground`, `PlanGeneratorPanel`, `PlanPolygonEditor`, `PlanRectangleEditor`, тулбары), `lib/padEarthworkSketch.ts` (контур, envelope berm, **`generatePadFromWells`**), `lib/envelopePlan.ts` (SVG кольца и бровок на плане), `lib/profileEnvelope.ts` (торцевые трапеции, объём кольца для профиля), `lib/padEarthworkDemPreview.ts` (hillshade/cut-fill), `lib/padEarthworkScene3d.ts` (terrain/pad/`buildEnvelopeBermRing`), `lib/infraPadWells.ts` (поля скважин и отступов в `properties`).

## Ограничения MVP

- Куст — **точка**; footprint от `lon/lat` + габариты (прямоугольник, центр) или вершины полигона (автогенерация: первая скважина).
- **Автогенерация:** один ряд скважин; без многорядных кустов; `well_count` на объекте куста не синхронизируется с POI `wells_per_pad`.
- Полигон: площадь по контуру; L/W в properties — охватывающий bbox для совместимости с полями формы.
- Режим **flat**: `cut_m3 = 0`; режим **DEM**: cut/fill по OpenTopography (нужен `OPENTOPOGRAPHY_API_KEY` на backend).
- Mesh GLB в ответе API есть; превью в UI — вкладка **3D** в модалке (призма + кольцо-забор варианта A + DEM preview, не полный GeoTIFF).
- **Обволование:** визуализация и оценка объёма в модалке — **вариант A** (кольцо на верху насыпи); `POST compute` — legacy усечённая пирамида planner (см. § Модель обволования).

## Локальный запуск

### Монолит (рекомендуется)

`run_local.py` при отсутствии пакета выполняет `pip install -e ../../../pad-earthwork-planner`:

```powershell
cd C:\Users\user\Documents\Cursore\decision-matrix\backend
.\venv\Scripts\Activate.ps1
python run_local.py
```

Первый запуск (явная установка, как для `autoroad-network-planner`):

```powershell
python -m pip install -e C:\Users\user\Documents\Cursore\pad-earthwork-planner
```

### Микросервис отдельно (порт 8081)

```powershell
cd C:\Users\user\Documents\Cursore\pad-earthwork-planner
pip install -e ".[dev]"
uvicorn pad_earthwork.api:app --host 127.0.0.1 --port 8081
```

Без `pip install`:

```powershell
python run_server.py
```

Проверка: `GET http://127.0.0.1:8081/health` → `{"status":"ok"}`.

### Docker (prod / CI)

При сборке backend образа CI копирует `pad-earthwork-planner` → `backend/pad-earthwork-vendor` (аналог `network-planner-vendor`). Локально для `docker build` из `decision-matrix/backend`:

```powershell
Copy-Item -Recurse C:\Users\user\Documents\Cursore\pad-earthwork-planner `
  C:\Users\user\Documents\Cursore\decision-matrix\backend\pad-earthwork-vendor
```

Микросервис в отдельном контейнере: `cd pad-earthwork-planner && docker compose up --build`.

## Устранение неполадок

| Симптом | Решение |
|---------|---------|
| `ModuleNotFoundError: pad_earthwork` при **compute** | `pip install -e ../../../pad-earthwork-planner` или перезапустить `run_local.py` |
| Backend не стартует (старая версия кода) | Обновите код; импорты теперь ленивые — старт не требует пакета |
| `uvicorn pad_earthwork.api:app` без установки | Используйте `python run_server.py` или `pip install -e .` |
| Docker build: `pad-earthwork-vendor` not found | Скопируйте пакет (см. выше) или используйте CI workflow |

## Тесты

| Область | Файлы |
|---------|--------|
| Микросервис | `pad-earthwork-planner/tests/` (в т.ч. `test_well_layout.py`) |
| Backend BFF | `decision-matrix/backend/tests/test_pad_earthwork_api.py` |
| Frontend | `frontend/src/lib/infraPadEarthwork.test.ts`, `padEarthworkSketch.test.ts`, `envelopeBermAnalysis.test.ts`, `envelopeBermGeometry.test.ts`, `profileEnvelope.test.ts`, `padEarthworkScene3d.test.ts` (полигон, автогенерация, envelope вариант A) |
