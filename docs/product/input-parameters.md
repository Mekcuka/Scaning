# Каталог исходных параметров ввода

Единый реестр полей, которые пользователь задаёт или которые система вычисляет из ввода. Используется при добавлении FR, миграций БД и экранов UI.

**Связанные документы:** [requirements.md](requirements.md), [database-schema.md](../architecture/database-schema.md), [map-objects-and-spatial-calculations.md](../features/map/map-objects-and-spatial-calculations.md), [calculation-functions.md](../calculations/calculation-functions.md), [consistency-review.md](../planning/consistency-review.md), [траектории скважин](../features/well-trajectory/well-trajectory.md) (M1–M3).

**Дата актуализации:** май 2026.

> **Согласование с кодом:** экраны и маршруты UI — [implementation-status.md](../planning/implementation-status.md).  
> **Подтипы на карте** (полный справочник, больше 8+КП) — [map-objects-and-spatial-calculations.md](../features/map/map-objects-and-spatial-calculations.md) §1.4; в **матрице анализа** по-прежнему 9 строк (4 internal linear + 4 external Point + кустовые площадки).

---

## Легенда

| Колонка | Описание |
|---------|----------|
| **id** | Стабильный идентификатор в API, тестах и документации |
| **Статус** | `mvp` — обязателен в MVP; `planned` — в ТЗ, UI/БД ещё нет; `candidate` — заявка на расширение; `deprecated` — снят с модели |
| **Тип** | `string`, `number`, `enum`, `boolean`, `geometry`, `json` |
| **Единица** | Единица отображения и хранения (если применимо) |
| **БД** | Таблица и колонка (или JSONB-путь) |
| **UI** | Экран / элемент приложения `decision-matrix/frontend` |
| **FR** | Ссылка на требование |
| **Влияет на расчёт** | `да` / `нет` / `отображение` |

**Денежные ставки:** ввод и хранение в **тыс. ₽** (`rate_thousand_rub`); в матрице и отчётах — **млн ₽** (÷ 1000).

**Экран «Параметры»** (`/parameters/*`, роли admin / analyst / viewer): массовое редактирование полей объектов проекта по вкладкам — пропускная способность (`/parameters/capacity`), **земляные работы** (`/parameters/earthwork`), **точки подключения** (`/parameters/footprint-connections`), объём песка (`/parameters/sand`), дата ввода (`/parameters/entry-dates`), ставки строительства (`/parameters/rates`). Excel-выгрузка на вкладках с таблицами (кроме «Точки подключения»).

**Подтипы инфраструктуры (8 + КП):** `autoroad`, `oil_pipeline`, `water_pipeline`, `power_line`, `gas_processing`, `gtes`, `substation`, `refinery` + вычисляемые **кустовые площадки** (`pads`, без поиска на карте). Подтип `marine_terminal` (морской порт как внешний объект) **снят** — транспорт «Морской порт» остаётся только в `eng_transport`.

---

## §1. Проект

### §1.1 Основные поля

| id | Статус | Тип | Единица | БД | UI | FR | Влияет на расчёт |
|----|--------|-----|---------|-----|-----|-----|------------------|
| `project_name` | mvp | string | — | `projects.name` | Проекты, модал «Новый проект» | FR-4.1.1 | нет |
| `project_description` | mvp | string | — | `projects.description` | Карточка проекта | FR-4.1.1 | нет |
| `project_status` | mvp | enum | — | `projects.status` | Список проектов | — | нет |
| `project_visibility` | mvp | enum | — | `projects.visibility` | Карточка проекта | FR-1.2.6 | нет |
| `project_settings` | mvp | json | — | `projects.settings` | — | — | расширяемый слот |

Значения `project_status`: `active`, `archived`, `completed`.

Значения `project_visibility`: `private` (по умолчанию), `published` (виден Viewer, FR-1.2.5).

### §1.2 Ставки стоимости (16 показателей, FR-4.1.2)

Одна строка на пару `(project_id, subtype)` в `project_cost_rates`. Ключи совпадают с `id` подтипа в API и UI.

**UI:** экран **Параметры → Ставки** (`/parameters/rates`); в колонке «UI» ниже — «Ставки» или «Параметры → Ставки».

#### Линейные внутренние (`rate_unit = per_km`, тыс. ₽/км)

| id | Статус | Подтип БД | По умолчанию | UI | FR |
|----|--------|-----------|-------------------------|-----|-----|
| `rate_autoroad` | mvp | `autoroad` | 5000 | Ставки | FR-4.1.2, FR-7.3.1 |
| `rate_oil_pipeline` | mvp | `oil_pipeline` | 8000 | Ставки | FR-4.1.2, FR-7.3.1 |
| `rate_water_pipeline` | mvp | `water_pipeline` | 6000 | Ставки | FR-4.1.2, FR-7.3.1 |
| `rate_power_line` | mvp | `power_line` | 3000 | Ставки | FR-4.1.2, FR-7.3.1 |

#### Площадные внешние (`rate_unit = fixed`, тыс. ₽ за объект)

| id | Статус | Подтип БД | По умолчанию | UI | FR |
|----|--------|-----------|--------------|-----|-----|
| `rate_gas_processing` | mvp | `gas_processing` | 500000 | Ставки | FR-7.3.2 |
| `rate_gtes` | mvp | `gtes` | 600000 | Ставки | FR-7.3.2, FR-7.3.4 |
| `rate_substation` | mvp | `substation` | 200000 | Ставки | FR-7.3.2 |
| `rate_refinery` | mvp | `refinery` | 0 | Ставки | FR-7.3.2 |
| `rate_marine_terminal` | deprecated | `marine_terminal` | — | — | Снят из внешних объектов (май 2026) |

#### Кустовые площадки (`rate_unit = per_unit`, тыс. ₽/шт.)

| id | Статус | Подтип БД | По умолчанию | UI | FR |
|----|--------|-----------|--------------|-----|-----|
| `rate_pads` | mvp | `pads` | 200000 | Ставки | FR-5.3, FR-7.3.3 |

#### Инженерное оборудование (`rate_unit = fixed`, тыс. ₽)

| id | Статус | Назначение | По умолчанию | UI | FR |
|----|--------|------------|--------------|-----|-----|
| `rate_eq_power` | mvp | Внутреннее электроснабжение (ГТЭС/ГПЭС) | 450000 | Ставки | FR-7.3.4 |
| `rate_eq_injection` | mvp | Локальная закачка (насосная) | 150000 | Ставки | FR-7.3.4 |
| `rate_eq_gas` | mvp | Утилизация газа — электрогенерация | 0 | Ставки | FR-7.3.4 |
| `rate_eq_mkos` | mvp | Подготовка нефти — МКОС | 100000 | Ставки | FR-5.2.4, FR-7.3.4 |
| `rate_eq_bmupn` | mvp | Подготовка нефти — БМУПН | 120000 | Ставки | FR-5.2.4 |
| `rate_eq_cps` | mvp | Подготовка нефти — ЦПС(УПН) | 150000 | Ставки | FR-5.2.4 |
| `rate_eq_upsv` | mvp | Подготовка нефти — УПСВ | 130000 | Ставки | FR-5.2.4 |

Транспортировка в ставках оборудования **не задаётся** (все варианты = 0; стоимость учитывается в подтипе «Нефтепровод», FR-7.3.4).

| id | Статус | Причина |
|----|--------|---------|
| `rate_gas_pipeline` | deprecated | Подтип удалён (май 2026) |
| `rate_collection_point` | deprecated | Подтип удалён |
| `rate_water_intake` | deprecated | Подтип удалён |
| `rate_eq_separation` | deprecated | Заменено на `eng_oil_preparation` + `rate_eq_mkos`…`rate_eq_upsv` |

### Шаблон точек подключения (`project_footprint_connection_templates`)

Одна строка на проект; поле `template` (JSON): подтип линии → `{ "cardinal", "t"? }` или `null` (центр). **UI:** **Параметры → Точки подключения**; API `GET/PUT …/footprint-connection-template`. При массовом apply записывается в `footprint_line_connections` объектов — [pad-earthwork.md](../features/pad-earthwork/pad-earthwork.md).

### §1.3 Пороги до внешних объектов (4, FR-4.1.5)

Geodesic-расстояние от POI до Point-объекта. Таблица `project_distance_defaults` / `points_of_interest`.

| id | Статус | Единица | Колонка БД | Дефолт (км) | UI | FR |
|----|--------|---------|------------|-------------|-----|-----|
| `threshold_gas_processing_km` | mvp | км | `max_distance_gas_processing_km` | 80 | Пороги до внешних (4) | FR-4.1.5 |
| `threshold_gtes_km` | mvp | км | `max_distance_gtes_km` | 50 | Пороги до внешних (4) | FR-4.1.5 |
| `threshold_substation_km` | mvp | км | `max_distance_substation_km` | 25 | Пороги до внешних (4) | FR-4.1.5 |
| `threshold_refinery_km` | mvp | км | `max_distance_refinery_km` | 100 | Пороги до внешних (4) | FR-4.1.5 |

| id | Статус | Примечание |
|----|--------|------------|
| `threshold_autoroad_km` … `threshold_power_line_km` | deprecated для статуса | Колонки `max_distance_autoroad_km` и т.д. — только **радиусы на карте** (FR-10.2), не сравнение internal |

### §1.5 Макс. суммарная длина internal linear (4, FR-4.1.5, FR-6.2.1b)

Сравнение с `distance_km = pads_count × km_per_pad`.

| id | Статус | Единица | Колонка БД | Дефолт (км) | UI | FR |
|----|--------|---------|------------|-------------|-----|-----|
| `max_total_line_autoroad_km` | mvp | км | `max_total_line_autoroad_km` | 50 | Макс. длина internal (4) | FR-4.2.13 |
| `max_total_line_oil_pipeline_km` | mvp | км | `max_total_line_oil_pipeline_km` | 40 | Макс. длина internal (4) | FR-4.2.13 |
| `max_total_line_water_pipeline_km` | mvp | км | `max_total_line_water_pipeline_km` | 30 | Макс. длина internal (4) | FR-4.2.13 |
| `max_total_line_power_line_km` | mvp | км | `max_total_line_power_line_km` | 30 | Макс. длина internal (4) | FR-4.2.13 |

> Кустовые площадки — без порога по расстоянию (FR-5.3.1).

### §1.4 Нормы км линейной инфраструктуры на 1 КП (4, FR-4.1.5, FR-5.3.4)

Таблица `project_distance_defaults` (те же строка на проект). При создании POI копируются в `points_of_interest.km_per_pad_*`.

| id | Статус | Единица | Колонка БД | Дефолт | UI | FR |
|----|--------|---------|------------|--------|-----|-----|
| `km_per_pad_autoroad` | mvp | км/КП | `km_per_pad_autoroad` | 3.0 | Проект → настройки | FR-4.1.5, FR-5.3.4 |
| `km_per_pad_oil_pipeline` | mvp | км/КП | `km_per_pad_oil_pipeline` | 3.0 | Проект → настройки | FR-5.3.4 |
| `km_per_pad_water_pipeline` | mvp | км/КП | `km_per_pad_water_pipeline` | 3.0 | Проект → настройки | FR-5.3.4 |
| `km_per_pad_power_line` | mvp | км/КП | `km_per_pad_power_line` | 3.0 | Проект → настройки | FR-5.3.4 |

**Вычисляемое:** `analysis_distance_km` (internal) = `poi_pads_count × km_per_pad(subtype)` — [calculation-functions.md](../calculations/calculation-functions.md) §3.

---

## §2. Точка интереса (POI)

### §2.1 Исходные данные точки

| id | Статус | Тип | Единица | БД | UI | FR | Влияет на расчёт |
|----|--------|-----|---------|-----|---------------|-----|------------------|
| `poi_name` | mvp | string | — | `points_of_interest.name` | `#poi-name`, `#map-poi-name` | FR-4.2.3 | нет |
| `poi_description` | mvp | string | — | `points_of_interest.description` | — | FR-4.2.3 | нет |
| `poi_geometry` | mvp | geometry | WGS84 | `points_of_interest.geometry` | Карта (клик), `#poi-coords` readonly | FR-4.2.2 | да (поиск объектов) |
| `poi_fluid_type` | mvp | enum | — | `fluid_type` | `#poi-fluid-type`, `#map-poi-fluid-type` | FR-4.2.10, FR-5.1.5 | да |
| `poi_planned_production_volume` | mvp | number | тыс. т/год | `planned_production_volume` | `#poi-volume`, `#map-poi-volume` | FR-4.2.3, FR-4.2.8 | да (КП) |
| `poi_water_injection_volume` | mvp | number | тыс. т/год | `water_injection_volume` | `#poi-water-injection`, `#map-poi-water-injection` | FR-4.2.11, FR-5.2.6 | да (КП локальная; **PFD** — popover «В пласт») |
| `poi_production_per_well` | mvp | number | тыс. т/год | `production_per_well` | `#poi-well-production` | FR-4.2.4, FR-5.3 | да (КП) |
| `poi_wells_per_pad` | mvp | number | шт. | `wells_per_pad` | `#poi-wells-per-pad` | FR-4.2.4, FR-5.3 | да (КП) |
| `poi_production_unit` | mvp | enum | — | `production_unit` | — (фикс. MVP) | FR-4.2.8 | нет |
| `poi_extended_params` | mvp | json | — | `extended_params` | — | — | слот candidate |

Значения `poi_fluid_type`: `oil` (нефть), `gas` (газ).

Значение `poi_production_unit` в MVP: `thousand_tons_per_year`.

**Вычисляемое (не ввод пользователя):**

| id | Формула | FR |
|----|---------|-----|
| `poi_pads_count` | `ceil((poi_planned_production_volume / poi_production_per_well) / poi_wells_per_pad)` | FR-5.3.1 |

Отображение: `#poi-pads-preview`, строка матрицы `pads`.

### §2.2 Инженерные параметры (бейджи)

Хранятся в колонках POI; в варианте — snapshot в `implementation_variants.applied_params`.

| id | Статус | Тип | Значения БД | UI | FR | Влияет на расчёт |
|----|--------|-----|-------------|---------------|-----|------------------|
| `eng_power_supply` | mvp | enum | `external`, `internal` | Бейджи «Электроснабжение», матрица `engKey=power` | FR-5.2.1 | да |
| `eng_injection_method` | mvp | enum | `centralized`, `local` | «Закачка», `injection` | FR-5.2.2, FR-5.2.6 | да |
| `eng_gas_utilization` | mvp | enum | `well`, `flare`, `power_generation` | «Утилизация газа», `gas` | FR-5.2.3 | да |
| `eng_oil_preparation` | mvp | enum | `mkos`, `bmupn`, `cps`, `upsv`, `mfns` | «Подготовка нефти», `oil_preparation` | FR-5.2.4 | да (оборудование) |
| `eng_well_gathering` | mvp | enum | `single_tube`, `dual_tube`, `combined` | «Сбор скважин», `well_gathering` | FR-5.2.7 | отображение |
| `eng_transport` | mvp | enum | `auto`, `marine`, `pipeline` | «Транспорт», `transport` | FR-5.4.1 | да |

**Подписи UI (рус.):**

| id | Варианты в интерфейсе |
|----|------------------------|
| `eng_power_supply` | Внешнее / Внутреннее |
| `eng_injection_method` | Централизованная / Локальная |
| `eng_gas_utilization` | В пласт / Факел / Электрогенерация |
| `eng_oil_preparation` | МКОС / БМУПН / ЦПС(УПН) / УПСВ / МФНС (без подготовки) |
| `eng_well_gathering` | Однотрубная / Двухтрубная / Комбинированная |
| `eng_transport` | Автовывоз / Морской порт / Магистральный трубопровод |

| id | Статус | Причина |
|----|--------|---------|
| `eng_separation` | deprecated | Заменено на `eng_oil_preparation` |
| `eng_use_collection_point` | deprecated | Заменено на `eng_oil_preparation` |

### §2.3 Пороги до внешних объектов на POI (4, override)

| id | Статус | UI | FR |
|----|--------|-----|-----|
| `threshold_gas_processing_km` … `threshold_refinery_km` (на POI) | mvp | «Пороги до внешних объектов (4)» | FR-4.2.6, FR-4.2.9 |

### §2.4 Нормы км/КП на точке (4, override)

Наследуются из §1.4 при создании POI. Колонки `points_of_interest.km_per_pad_*`.

| id | Статус | UI | FR |
|----|--------|-----|-----|
| `km_per_pad_*` (на POI) | mvp | Блок «Нормы линейной инфраструктуры (4)» | FR-4.2.12, FR-5.3.4 |

### §2.5 Макс. суммарная длина internal на POI (4, override)

| id | Статус | UI | FR |
|----|--------|-----|-----|
| `max_total_line_*_km` (на POI) | mvp | «Макс. суммарная длина internal (4)» | FR-4.2.6, FR-4.2.13 |

---

## §3. Инфраструктура и импорт

### §3.1 Объекты на карте (ручное / импорт)

| id | Статус | Тип | БД | UI | FR |
|----|--------|-----|-----|-----|-----|
| `infra_object_name` | mvp | string | `infrastructure_objects.name` | Диалог карты, CSV | FR-2.3.2 |
| `infra_object_geometry` | mvp | geometry | `infrastructure_objects.geometry` | Точка / линия на карте | FR-2.3.1, FR-2.3.7 |
| `infra_object_geometry_type` | mvp | enum | вывод из `ST_GeometryType` | — | FR-2.3.7 |
| `infra_object_category` | mvp | enum | `category` | Авто по `type` | FR-2.3.2 |
| `infra_object_subtype` | mvp | enum | `subtype` | 8 подтипов + КП (без `marine_terminal`) | FR-6.1.1 |
| `infra_object_properties` | mvp | json | `properties` | — | FR-2.3.2 |
| `infra_throughput_capacity_annual` | mvp | number | `properties.throughput_capacity_annual` | Карта → карточка точечного объекта | [fluid-flow-schematic.md](../features/flows/fluid-flow-schematic.md) §7 |
| `infra_capacity_unit` | mvp | enum | `properties.capacity_unit` | то же | `thousand_t_per_year` \| `thousand_m3_per_year` |
| `infra_network_id` | planned | uuid | `infrastructure_nodes.network_id` | — | FR-2.4.5 |

Ключи пропускной способности — только для **точечных** подтипов, кроме: `node`, `oil_pad`, `gas_pad`, `sand_quarry`, `substation`, `vies`, `gtes`, `gpes`. См. [map-objects-and-spatial-calculations.md](../features/map/map-objects-and-spatial-calculations.md) §1.6.

| ID | Статус | Тип | Хранение | UI | Примечание |
|----|--------|-----|----------|-----|------------|
| `sand_volume_initial_m3` | mvp | number | `properties` | Карта → карьер песка | Начальный запас, м³ |
| `sand_volume_current_m3` | mvp | number | `properties` | то же | Текущий остаток, м³; рекомендуется ≤ initial |
| `sand_volume_m3` | mvp | number | `properties` | Карта → точечный объект (кроме `node`, `sand_quarry`) | Спрос потребителя, м³ в режиме «Объём на дату ввода» |
| `sand_volume_by_year` | mvp | object | `properties` | Карта → вкладка **Логистика** | План спроса по календарным годам, м³; в расчёте — накопительная сумма на `as_of` |
| `sand_volume_mode` | mvp | string | `properties` | Карта → вкладка **Логистика** | `single` — объём на дату ввода; `yearly` — план по годам (взаимоисключающие) |

См. [map-objects-and-spatial-calculations.md](../features/map/map-objects-and-spatial-calculations.md) §1.7, расчёт — вкладка **Потоки → Логистика**.

| ID | Статус | Тип | Хранение | UI | Примечание |
|----|--------|-----|----------|-----|------------|
| `infra_entry_date` | mvp | date (ISO) | `properties.entry_date` | Карта, **Параметры → Дата ввода** | Все подтипы кроме `node`; default `2020-01-01` |

См. [map-objects-and-spatial-calculations.md](../features/map/map-objects-and-spatial-calculations.md) §1.8.

#### Земляные работы площадки (точечные объекты)

См. [pad-earthwork.md](../features/pad-earthwork/pad-earthwork.md). Блок **Логистика** — все подтипы `point.map`, **кроме** `node`. Ключи в `infrastructure_objects.properties` (общие для кустов и прочих объектов):

**Скважины и генератор** — только `oil_pad` / `gas_pad`:

| id | Статус | Тип | Ключ `properties` | UI | Примечание |
|----|--------|-----|-------------------|-----|------------|
| `pad_well_count` | mvp | integer | `pad_well_count` | **Эксплуатация** (главная вкладка) и модалка **Схема…** → **Генератор** | Количество скважин; default 12 |
| `pad_wells_per_group` | mvp | integer | `pad_wells_per_group` | то же | Скважин в группе; default 1 |
| `pad_well_spacing_m` | mvp | number | `pad_well_spacing_m` | то же | Шаг в группе, м; default 9 |
| `pad_well_group_spacing_m` | mvp | number | `pad_well_group_spacing_m` | то же | Шаг между группами, м; default 9 |
| `pad_layout_margin_left_m` | mvp | number | `pad_layout_margin_left_m` | то же | Отступ слева от 1-й скважины; default 27 |
| `pad_layout_margin_bottom_m` | mvp | number | `pad_layout_margin_bottom_m` | то же | Вниз от линии скважин; default 43 |
| `pad_layout_margin_top_m` | mvp | number | `pad_layout_margin_top_m` | то же | Вверх от линии скважин; default 15 |
| `pad_layout_margin_end_m` | mvp | number | `pad_layout_margin_end_m` | то же | От последней скважины (справа); default 70 |
| `pad_rotation_deg` | mvp | number | `pad_rotation_deg` | **Логистика** (карточка); **Генератор** (модалка, только куст); **Параметры → Земляные работы** | НДС для куста / поворот прямоугольника, ° (0…360, default 90) |
| `pad_wells_local_json` | mvp | json array | `pad_wells_local_json` | — (сохраняется PATCH `sketch`) | `[{east_m, north_m}, …]` — маркеры скважин на схеме |
| `pad_length_m`, `pad_width_m`, `pad_height_m` | mvp | number | см. ключи | **Логистика**; **Параметры → Земляные работы** | Габариты площадки; default **120×80×1** м (L/W/H), если не заданы |
| `pad_earthwork_sketch_json`, `pad_*_volume_*`, envelope | mvp | mixed | см. [pad-earthwork.md](../features/pad-earthwork/pad-earthwork.md) § Модель объёмов | **Логистика** / модалка | Схема, кэш объёмов; отсыпка и выемка независимы; обваловка (W — ширина подошвы) |
| `pad_reference_elevation_m` | mvp | number | `pad_reference_elevation_m` | **Логистика** / модалка **3D**; **Параметры → Земляные работы** | Опорная отметка подошвы насыпи; default **0** м |
| `footprint_line_connections` | mvp | json | `footprint_line_connections` | **Карта** (режим «Площадки», карточка); **Параметры → Точки подключения** (apply) | Подтип линии → `{ edge_index, t }` или `null` (центр); display-only — [pad-earthwork.md](../features/pad-earthwork/pad-earthwork.md) |
| `pad_dem_asset_id` | mvp | uuid string | `pad_dem_asset_id` | — (зеркало БД) | UUID записи DEM; дублируется из `infra_object_pad_dem` для UI |
| `pad_dem_fetched_at` | mvp | ISO datetime | `pad_dem_fetched_at` | модалка **Схема…** | Время последней загрузки DEM |
| `pad_dem_source` | mvp | string | `pad_dem_source` | — | Источник, напр. `opentopography:COP30` |
| `pad_dem_bbox_hash` | mvp | string | `pad_dem_bbox_hash` | — | Хэш bbox запроса (кэш fetch) |

**Таблица БД `infra_object_pad_dem`** (миграция `024`): каноническое хранение метаданных DEM; файл GeoTIFF — `{PAD_DEM_DATA_ROOT}/{project_id}/{id}.tif`. См. [pad-dem-storage.md](../deploy/pad-dem-storage.md).

#### Траектории скважин (3D)

Подробнее: [well-trajectory.md](../features/well-trajectory/well-trajectory.md), **[таблица welleng / PyWellGeo](../features/well-trajectory/well-trajectory-app-assessment.md#45-настройки-расчёта-welleng--pywellgeo-вкладка-расчёт)**, [well-trajectory-data-model.md](../features/well-trajectory/well-trajectory-data-model.md). Только кусты `oil_pad` / `gas_pad`; координаты устьев — из `pad_wells_local_json`.

**JSON в `properties` куста:**

| id | Статус | Тип | Ключ / хранение | UI | Примечание |
|----|--------|-----|-----------------|-----|------------|
| `pad_wells_trajectories_json` | mvp | json array | `pad_wells_trajectories_json` | **Кустование**; карточка куста | Массив: индекс, имя, **`target`**, survey, `geometry`, опц. **`clearance`** |
| `well_trajectory_computed_at` | mvp | ISO datetime | `well_trajectory_computed_at` | — | Последняя интерполяция survey |
| `well_trajectory_clearance_pairs_json` | mvp | json array | `well_trajectory_clearance_pairs_json` | карточка куста; **Кустование** | Пары SF с участием скважин куста |
| `well_trajectory_clearance_computed_at` | mvp | ISO datetime | `well_trajectory_clearance_computed_at` | — | Последний расчёт SF |

**Настройки расчёта на кусте** (welleng; вкладка **«Расчёт»** на `/pad-clustering`):

| id | Статус | Тип | Ключ | UI | Default | Примечание |
|----|--------|-----|------|-----|---------|------------|
| `well_trajectory_step_m` | mvp | number | `well_trajectory_step_m` | **Кустование → Расчёт** | 30 | Шаг survey; `design-from-bottomholes` |
| `well_trajectory_azi_reference` | mvp | enum | `well_trajectory_azi_reference` | то же | `grid` | `grid` / `magnetic` / `true` |
| `well_trajectory_error_model` | mvp | string | `well_trajectory_error_model` | то же | `ISCWSA MWD Rev5.11` | В JSON скважины; **clearance (ISCWSA)** |
| `well_trajectory_stub_tvd_m` | mvp | number | `well_trajectory_stub_tvd_m` | то же | 100 | TVD вертикальной заготовки |
| `well_trajectory_default_tvd_m` | mvp | number | `well_trajectory_default_tvd_m` | то же | 1500 | Сохраняется; design fallback — пробел |
| `well_trajectory_inc_heel` | mvp | number | `well_trajectory_inc_heel` | то же | 90 | Inc на Т1 (ГС) |
| `well_trajectory_gs_entry_search_step_m` | mvp | number | `well_trajectory_gs_entry_search_step_m` | **Кустование → Расчёт** | 30 | Шаг перебора точки входа ГС при режиме `any` |
| `well_trajectory_sf_warning_threshold` | mvp | number | `well_trajectory_sf_warning_threshold` | то же | 1.0 | Порог SF; **clearance + warnings + 3D**; фильтр кандидатов при `any` |

**PyWellGeo (вкладка «PyWellGeo» на `/pad-clustering`):**

| id | Статус | Тип | Ключ | UI | Default | Примечание |
|----|--------|-----|------|-----|---------|------------|
| `pad_pywellgeo_settings_json` | mvp | json | `pad_pywellgeo_settings_json` | **Кустование → PyWellGeo** | radius 0.10795 m, Tsurface 10 °C | Defaults для WellTree / thermal |
| `pad_pywellgeo_trees_json` | mvp | json array | `pad_pywellgeo_trees_json` | то же | — | Деревья по `well_index`; узлы/ветви/перфорации |
| `pad_pywellgeo_last_computed_at` | mvp | ISO datetime | `pad_pywellgeo_last_computed_at` | — | — | Последний compute / apply geometry |
| `pywellgeo` (в trajectory[i]) | mvp | json | блок в `pad_wells_trajectories_json` | — | — | Расширенная geometry + branch_stats после apply |

**Настройки проекта** (`projects.settings.well_trajectory`) — **не реализованы** (дублируют per-pad; в roadmap):

| id | Статус | Тип | По умолчанию | Примечание |
|----|--------|-----|--------------|------------|
| `well_trajectory_default_error_model` | planned | string | `ISCWSA MWD Rev5.11` | Per-pad: `well_trajectory_error_model` |
| `well_trajectory_default_azi_reference` | planned | enum | `grid` | Per-pad: `well_trajectory_azi_reference` |
| `well_trajectory_sf_threshold` | planned | number | `1.0` | Per-pad: `well_trajectory_sf_warning_threshold` |
| `well_trajectory_default_target_tvd_m` | planned | number | — | Per-pad: `well_trajectory_default_tvd_m` |
| `well_trajectory_units` | planned | enum | `metric` | Метры; футы — с фазы 4 |

**Объекты-забои на карте** (`well_bottomhole_nnb`, `well_bottomhole_gs`, `well_bottomhole_gs_heel`, `well_bottomhole_gs_toe`):

| id | Статус | Тип | Ключ properties | UI | Примечание |
|----|--------|-----|-----------------|-----|------------|
| `well_bottomhole_linked_pad_id` | mvp | UUID | `well_bottomhole_linked_pad_id` | карточка забоя / auto при рисовании | Обязателен для NNB |
| `well_bottomhole_well_index` | mvp | int 0…63 | `well_bottomhole_well_index` | карточка забоя | Пусто → ближайшее устье |
| `well_bottomhole_tvd_m` | mvp | number | `well_bottomhole_tvd_m` | карточка / **Геометрия** (ННБ) | TVD; default 1500 м; связь Z ↔ TVD через KB куста |
| `well_bottomhole_heel_tvd_m` | mvp | number | `well_bottomhole_heel_tvd_m` | **Геометрия** / «Параметры забоя» (ГС) | TVD Т1; fallback — `well_bottomhole_tvd_m` |
| `well_bottomhole_toe_tvd_m` | mvp | number | `well_bottomhole_toe_tvd_m` | то же | TVD Т3 |
| `well_bottomhole_target_inc` | mvp | number | `well_bottomhole_target_inc` | карточка NNB, «Кустование» | Default **360°** (welleng ≈ 0°); горизонталь — **90°** |
| `well_bottomhole_target_azi` | mvp | number | `well_bottomhole_target_azi` | карточка | Default NDS куста |
| `well_bottomhole_gs_heel_id` | mvp | UUID | `well_bottomhole_gs_heel_id` | карточка Т3 | Связь Т1 ↔ Т3 (legacy pair) |
| `well_bottomhole_gs_entry_mode` | mvp | enum | `well_bottomhole_gs_entry_mode` | карточка ГС, «Кустование» | `any` (default) / `Т1` / `Т3` — точка входа на горизонталь |
| `well_bottomhole_role` | mvp | enum | `well_bottomhole_role` | карточка забоя, «Кустование» | `main` (default) / `lateral` — основной забой / доп.ствол |
| `well_bottomhole_parent_id` | mvp | UUID | `well_bottomhole_parent_id` | карточка lateral | Обязателен для `lateral`; ссылка на основной забой; куст и `well_index` наследуются |

**Геометрия объекта-забоя (не properties):** для ГС — `LineString` Т1→Т3 (`well_bottomhole_gs`); координаты и Z редактируются на вкладке **«Геометрия»** (`InfraBottomholeGeometrySection`); длина на плане и **3D-длина** (√(plan² + ΔZ²)) для unified ГС.

**Блок `target` / `design` в `pad_wells_trajectories_json[i]` (после sync/design):**

| Поле | Примечание |
|------|------------|
| `target.gs_entry_mode` | Копия из объекта-забоя |
| `target.heel_tvd_m`, `target.toe_tvd_m` | TVD концов ГС (профиль `gs`) |
| `target.heel_plan` | План Т1 (east_m, north_m) |
| `design.gs_entry_mode` | Фактический режим после расчёта (`any` / `Т1` / `Т3`) |
| `design.gs_entry_offset_m` | Смещение точки входа от Т1, м |
| `design.gs_entry_plan` | План точки входа (northing, easting) |

**Целевой вариант (таблицы БД, фаза 2+):** `project_well`, `well_survey_station`, `well_trajectory_result` — [модель данных](../features/well-trajectory/well-trajectory-data-model.md).

Значения `infra_object_geometry_type`: `point` (`ST_Point`), `linestring` (`ST_LineString` / `ST_MultiLineString`). Соответствие подтипу — [map-objects-and-spatial-calculations.md](../features/map/map-objects-and-spatial-calculations.md) §1.4.

#### Распределение подтипов по геометрии (FR-2.3.9)

| `subtype` | Геометрия | Название UI | CSV / карта |
|-----------|-----------|-------------|-------------|
| `gas_processing` | **point** | ГКС | `lat`, `lon` / «Точка» |
| `gtes` | **point** | ГТЭС / ГПЭС | `lat`, `lon` / «Точка» |
| `substation` | **point** | ПС / ТП | `lat`, `lon` / «Точка» |
| `refinery` | **point** | НПЗ | `lat`, `lon` / «Точка» |
| `autoroad` | **linestring** | Автодорога | `start_*`, `end_*` / «Линия» |
| `oil_pipeline` | **linestring** | Нефтепровод | `start_*`, `end_*` / «Линия» |
| `water_pipeline` | **linestring** | Водопровод | `start_*`, `end_*` / «Линия» |
| `power_line` | **linestring** | ЛЭП | `start_*`, `end_*` / «Линия» |
| `pads` | — | Кустовые площадки | не на карте |

Polygon для площадных подтипов в MVP не используется.

### §3.2 Импорт API (FR-2.5.1)

| id | Статус | Тип | UI | FR |
|----|--------|-----|---------------|-----|
| `import_api_url` | mvp | string | `#import-api-url` | FR-2.5.1 |
| `import_api_registry` | mvp | enum | `#import-api-registry` | FR-2.5.1 |
| `import_api_auth_type` | mvp | enum | `#import-api-auth` | FR-2.5.1 |
| `import_api_token` | mvp | string | `#import-api-token` | FR-2.5.1 |

Значения `import_api_registry` (пример): реестр дорог, трубопроводов, площадных, энергообъектов.

Значения `import_api_auth_type`: `bearer`, `api_key`, `basic`.

### §3.3 Импорт файлов (FR-2.5.3)

**Точечные объекты (CSV / GeoJSON):**

| id | Статус | Колонка / поле | Обязательно |
|----|--------|----------------|-------------|
| `import_file_name` | mvp | `name` | да |
| `import_file_type` | mvp | `type` → `subtype` | да |
| `import_file_lat` | mvp | `lat` | да |
| `import_file_lon` | mvp | `lon` | да |

**Линейные объекты:**

| id | Статус | Колонка |
|----|--------|---------|
| `import_file_start_lat` | mvp | `start_lat` |
| `import_file_start_lon` | mvp | `start_lon` |
| `import_file_end_lat` | mvp | `end_lat` |
| `import_file_end_lon` | mvp | `end_lon` |

Форматы MVP: GeoJSON, CSV, Shapefile, KML/KMZ (FR-2.5.3). Журнал: `import_logs`.

---

## §4. Анализ окружения (результаты, не ввод)

Заполняется сервисом анализа в `poi_infrastructure_analysis`. Инженер может переопределить (FR-6.3).

| id | Статус | Тип | БД | Влияет на расчёт |
|----|--------|-----|-----|------------------|
| `analysis_subtype` | mvp | enum | `subtype` | да |
| `analysis_param_type` | mvp | enum | `param_type` (`internal` / `external`) | да |
| `analysis_nearest_object_id` | mvp | uuid | `nearest_object_id` | да (только external) |
| `analysis_nearest_node_id` | planned | uuid | `nearest_node_id` | да |
| `analysis_distance_km` | mvp | number | `distance_km` | да |
| `analysis_distance_source` | mvp | enum | `distance_source` | да |
| `analysis_distance_method` | mvp | enum | `distance_method` | да |
| `analysis_anchor_type` | mvp | enum | `anchor_type` | да (nullable для internal) |
| `analysis_anchor_geometry` | mvp | geometry | `anchor_geometry` (POINT) | отображение |
| `analysis_distance_status` | mvp | enum | `distance_status` | да |
| `analysis_max_allowed_km` | mvp | number | `max_allowed_distance_km` | да |
| `analysis_manual_override` | mvp | boolean | `is_manually_overridden` | да |
| `analysis_overridden_object_id` | mvp | uuid | `overridden_object_id` | да |

Значения `analysis_distance_status`: `within_limit`, `exceeds_limit`, `construction_required`, `not_required` (FR-6.2.1).

Значения `analysis_distance_source` (MVP): `geodesic` (внешние), `pads_per_pad_formula` (внутренние линейные), `manual_override` (ручное переопределение).

Значения `analysis_anchor_type` (MVP): `point_object` (внешние); NULL (внутренние линейные); planned: `network_node`.

Значения `analysis_distance_method`: `geodesic` (MVP для external); `along_network` (planned).

---

## §5. Базовый расчёт и матрица POI

| id | Статус | Тип | БД | UI | FR |
|----|--------|-----|-----|-----|-----|
| `variant_name` | mvp | string | `implementation_variants.name` | Матрица, карточка POI | FR-7.2 |
| `variant_applied_params` | mvp | json | `applied_params` | Snapshot инженерных полей | FR-7.1.2 |
| `variant_cost_override_subtype` | mvp | enum | `variant_cost_overrides.subtype` | Ручная правка в матрице ✏️ | FR-7.3.6 |
| `variant_cost_override_amount` | mvp | number | `manual_cost` | млн ₽ в UI | FR-7.3.6 |
| `variant_cost_override_note` | mvp | string | `note` | — | FR-7.3.6 |
| `variant_distance_km_override` | mvp | number | `variant_infrastructure_items.distance_km` (override) | Матрица, internal/external | FR-6.3.5 |
| `variant_km_per_pad_override` | mvp | number | snapshot в `applied_params` | Матрица, internal | FR-6.3.5 |

**Вычисляемые поля варианта:** `variant_total_cost`, `variant_engineering_equipment_cost`, `variant_overall_status` (FR-7.3.5–7.3.6, FR-6.2.3). Столбцы матрицы — точки интереса (`poi_id`).

---

## §6. Оптимизация размещения кустов

Параметры расчёта **размещения новых кустов по забоям на карте** (режим «с нуля», без изменения существующих площадок). Спецификация: [pad-placement-optimization.md](../features/pad-placement/pad-placement-optimization.md), модель данных: [pad-placement-optimization-data-model.md](../features/pad-placement/pad-placement-optimization-data-model.md).

| id | Статус | Тип | Ключ / хранение | UI | Описание |
|----|--------|-----|-----------------|-----|----------|
| `max_wells_per_pad` | mvp | integer | `PadPlacementParams` / POST body | Панель «Оптимизация кустов» | Максимум скважин на одном кусте; по умолчанию 12 |
| `min_pad_spacing_m` | mvp | number | POST body | то же | Мин. расстояние между **новыми** кустами и до существующих, м |
| `step_m` | mvp | number | POST body | то же | Шаг инклинометрии при design |
| `sf_check` | mvp | boolean | POST body | то же | Учитывать SF при сравнении вариантов |
| `sf_threshold` | mvp | number | POST body | то же | Порог SF |
| `top_k` | mvp | integer | POST body | то же | Сколько лучших вариантов показать (по умолчанию 5) |
| `center_optimize` | mvp | boolean | POST body | «Расширенные» | Перебор центра куста по минимальной Σ MD (M2+) |
| `center_search_radius_m` | mvp | number | POST body | «Расширенные» | Радиус окна поиска центра, м (по умолч. 400) |
| `center_search_step_m` | mvp | number | POST body | «Расширенные» | Шаг сетки перебора, м (по умолч. 200; потолок сетки 5×5) |
| `gs_entry_search_step_m` | mvp | number \| null | POST body | API / расширенные (опц.) | Шаг перебора точки входа ГС при `any`; `null` — адаптивный (длина ÷ 10) |

**Async:** при N > 8 логических скважин или > 100 комбинаций разбиения — `POST compute?async=true` → `pad_placement_compute` (журнал задач).

**Таймаут:** синхронный `compute` / `apply` — до **600 с** (frontend `PAD_PLACEMENT_TIMEOUT_MS`, backend `WELL_TRAJECTORY_HTTP_TIMEOUT_SECONDS`).

**Производительность:** pad placement не вызывает SF на каждом offset точки входа ГС; при `sf_check=true` clearance один раз на вариант. Перебор центра — двухфазный (грубый + финальный). См. [pad-placement-optimization.md](../features/pad-placement/pad-placement-optimization.md) § «Производительность».

**Типы фоновых задач** (`project_jobs.job_type`): `pad_placement_compute`, `pad_placement_apply`.

**После применения** на созданных кустах используются те же ключи, что и при обычном кустовании: `pad_well_spacing_m`, `pad_wells_per_group`, `well_trajectory_*`.

---

## §7. Одностраничник (FR-11)

| id | Статус | Тип | БД | UI | FR |
|----|--------|-----|-----|---------------|-----|
| `one_pager_title` | mvp | string | `one_pagers.title` | Заголовок отчёта | FR-11.1.2 |
| `one_pager_coordinates` | mvp | string | `coordinates` | Шапка | FR-11.1.2 |
| `one_pager_engineer_name` | mvp | string | `engineer_name` | Шапка | FR-11.1.2 |
| `one_pager_report_date` | mvp | date | `report_date` | Шапка | FR-11.1.2 |
| `one_pager_poi_id` | mvp | uuid | `one_pagers.poi_id` | Выбор POI для отчёта | FR-11.1.1 |
| `one_pager_map_snapshot` | mvp | string | `map_snapshot_base64` | PNG карты для PPTX | FR-11.2.2 |
| `one_pager_recommendation_text` | mvp | string | `recommendation_text` | Блок рекомендации | FR-11.1.2 |
| `one_pager_roadmap` | mvp | json | `roadmap` | Дорожная карта | FR-11.1.2 |

---

## §8. Пользователи и аутентификация (FR-1)

| id | Статус | Тип | БД | UI | FR |
|----|--------|-----|-----|-----|-----|
| `auth_email` | mvp | string | `users.email` | `#login-form` | FR-1.1.1 |
| `auth_password` | mvp | string | — (hash) | `#login-form` | FR-1.1.5 |
| `auth_username` | mvp | string | `users.username` | Регистрация | FR-1.3.1 |
| `user_role` | mvp | enum | `user_roles` | Admin / Analyst / Data Manager / Viewer | FR-1.2.1 |

---

## §9. Сводка по статусам (MVP)

| Раздел | Параметров (прибл.) | mvp | planned |
|--------|----------------------|-----|---------|
| §1 Проект | 30 | 30 | 0 |
| §2 POI | 32 | 32 | 0 |
| §3 Импорт / инфра | 16 | 15 | 1 |
| §4 Анализ (выход) | 12 | 11 | 1 |
| §5 Матрица POI | 7 | 7 | 0 |
| §7 Одностраничник | 7 | 7 | 0 |
| §8 Auth | 4 | 4 | 0 |
| **Итого** | **~100** | **~97** | **~2** |

Целевой объём MVP из ревизии: **~72 исходных id** с вводом пользователя (без чисто вычисляемых и deprecated).

---

## §10. Заявка на новый параметр (candidate)

Перед добавлением в каталог заполните:

```markdown
### Заявка: <краткое имя>

- **id (предлагаемый):** 
- **Уровень:** проект | POI | вариант | импорт
- **Тип / единица:** 
- **Зачем (бизнес):** 
- **Влияет на расчёт:** да / нет / только UI
- **Предлагаемая БД:** таблица.колонка или `extended_params.<key>`
- **Экран UI:** 
- **Связанные FR:** 
- **Миграция / обратная совместимость:** 
- **Статус:** candidate → после согласования `mvp`
```

После согласования:

1. Добавить строку в этот файл.
2. Обновить [requirements.md](requirements.md), [user-flows.md](user-flows.md).
3. При влиянии на расчёт — [calculation-functions.md](../calculations/calculation-functions.md) и [calculation-logic-flow.md](../calculations/calculation-logic-flow.md).
4. [database-schema.md](../architecture/database-schema.md).
5. Запись в [consistency-review.md](../planning/consistency-review.md).

---

## История изменений

| Дата | Изменение |
|------|-----------|
| 2026-05 | Первая версия каталога; 16 ставок; 8 подтипов + КП; `poi_fluid_type`, `poi_water_injection_volume`; `eng_oil_preparation`, `eng_well_gathering`; сняты gas_pipeline, collection_point, water_intake, `marine_terminal` (внешний объект) |
| 2026-05 | `infra_object_geometry_type`; `analysis_anchor_*`, `analysis_distance_method`; planned `infra_network_id`, `analysis_nearest_node_id` |
| 2026-05 | `km_per_pad_*` (4); `analysis_distance_source`; internal linear = pads × km/КП; threshold_* → mvp; `project_visibility` |
| 2026-06 | `pad_well_*`, `pad_layout_margin_*`, `pad_wells_local_json`, НДС; автогенерация и редактор схемы — [pad-earthwork.md](../features/pad-earthwork/pad-earthwork.md) |
| 2026-06 | DEM куста: таблица `infra_object_pad_dem`, `pad_dem_*` в properties, volume `pad_dem_data` — [pad-dem-storage.md](../deploy/pad-dem-storage.md) |
| 2026-06 | Земляные работы на всех точечных объектах (кроме **Узел**), включая **Карьер песка**; режим карты **Площадки** (контуры footprint); генератор скважин — только кусты — [pad-earthwork.md](../features/pad-earthwork/pad-earthwork.md) |
| 2026-06 | **Параметры → Земляные работы** — табличное редактирование L/W/H, опорной, поворота для всех earthwork-eligible объектов |
| 2026-06 | **Параметры → Точки подключения** — шаблон cardinal по типам линий, backend `project_footprint_connection_templates`, массовое apply + undo — [pad-earthwork.md](../features/pad-earthwork/pad-earthwork.md) |
| 2026-06 | Траектории скважин: `pad_wells_trajectories_json`, welleng settings, **clearance** (`well_trajectory_clearance_*`, `clearance.min_sf`) — [well-trajectory.md](../features/well-trajectory/well-trajectory.md) |
| 2026-06 | Забои: **геометрия** (X/Y/Z), dual TVD ГС, `well_bottomhole_gs_entry_mode`, `well_trajectory_gs_entry_search_step_m`, оптимизация точки входа `any` + SF — [well-trajectory.md](../features/well-trajectory/well-trajectory.md) §2b |
| 2026-06 | Цепочка **основной забой → доп.ствол** (`well_bottomhole_role`, `well_bottomhole_parent_id`); пунктир parent→lateral скрывается при ветке PyWellGeo — [well-trajectory.md](../features/well-trajectory/well-trajectory.md) §2c, [map-objects-and-spatial-calculations.md](../features/map/map-objects-and-spatial-calculations.md) §1.4.5 |
| 2026-06 | §6 **Оптимизация размещения кустов** (mvp): `PadPlacementParams`, M2+ `center_optimize*` — [pad-placement-optimization.md](../features/pad-placement/pad-placement-optimization.md) |
| 2026-06 | §6: `gs_entry_search_step_m`, двухфазный поиск центра, таймаут 600 с, SF только при `sf_check` |
| 2026-05 | §3.1 таблица subtype → point/linestring (FR-2.3.9) |
