# Каталог исходных параметров ввода

Единый реестр полей, которые пользователь задаёт или которые система вычисляет из ввода. Используется при добавлении FR, миграций БД и экранов UI.

**Связанные документы:** [requirements.md](./requirements.md), [database-schema.md](./database-schema.md), [map-objects-and-spatial-calculations.md](./map-objects-and-spatial-calculations.md), [calculation-functions.md](./calculation-functions.md), [consistency-review.md](./consistency-review.md).

**Дата актуализации:** май 2026.

> **Согласование с кодом:** экраны и маршруты UI — [implementation-status.md](./implementation-status.md).  
> **Подтипы на карте** (полный справочник, больше 8+КП) — [map-objects-and-spatial-calculations.md](./map-objects-and-spatial-calculations.md) §1.4; в **матрице анализа** по-прежнему 9 строк (4 internal linear + 4 external Point + кустовые площадки).

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

**Вычисляемое:** `analysis_distance_km` (internal) = `poi_pads_count × km_per_pad(subtype)` — [calculation-functions.md](./calculation-functions.md) §3.

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
| `infra_throughput_capacity_annual` | mvp | number | `properties.throughput_capacity_annual` | Карта → карточка точечного объекта | [fluid-flow-schematic.md](./fluid-flow-schematic.md) §7 |
| `infra_capacity_unit` | mvp | enum | `properties.capacity_unit` | то же | `thousand_t_per_year` \| `thousand_m3_per_year` |
| `infra_network_id` | planned | uuid | `infrastructure_nodes.network_id` | — | FR-2.4.5 |

Ключи пропускной способности — только для **точечных** подтипов, кроме: `node`, `oil_pad`, `gas_pad`, `sand_quarry`, `substation`, `vies`, `gtes`, `gpes`. См. [map-objects-and-spatial-calculations.md](./map-objects-and-spatial-calculations.md) §1.6.

| ID | Статус | Тип | Хранение | UI | Примечание |
|----|--------|-----|----------|-----|------------|
| `sand_volume_initial_m3` | mvp | number | `properties` | Карта → карьер песка | Начальный запас, м³ |
| `sand_volume_current_m3` | mvp | number | `properties` | то же | Текущий остаток, м³; рекомендуется ≤ initial |
| `sand_volume_m3` | mvp | number | `properties` | Карта → точечный объект (кроме `node`, `sand_quarry`) | Спрос потребителя, м³ в режиме «Объём на дату ввода» |
| `sand_volume_by_year` | mvp | object | `properties` | Карта → вкладка **Логистика** | План спроса по календарным годам, м³; в расчёте — накопительная сумма на `as_of` |
| `sand_volume_mode` | mvp | string | `properties` | Карта → вкладка **Логистика** | `single` — объём на дату ввода; `yearly` — план по годам (взаимоисключающие) |

См. [map-objects-and-spatial-calculations.md](./map-objects-and-spatial-calculations.md) §1.7, расчёт — вкладка **Потоки → Логистика**.

| ID | Статус | Тип | Хранение | UI | Примечание |
|----|--------|-----|----------|-----|------------|
| `infra_entry_date` | mvp | date (ISO) | `properties.entry_date` | Карта, **Параметры → Дата ввода** | Все подтипы кроме `node`; default `2020-01-01` |

См. [map-objects-and-spatial-calculations.md](./map-objects-and-spatial-calculations.md) §1.8.

Значения `infra_object_geometry_type`: `point` (`ST_Point`), `linestring` (`ST_LineString` / `ST_MultiLineString`). Соответствие подтипу — [map-objects-and-spatial-calculations.md](./map-objects-and-spatial-calculations.md) §1.4.

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
2. Обновить [requirements.md](./requirements.md), [user-flows.md](./user-flows.md).
3. При влиянии на расчёт — [calculation-functions.md](./calculation-functions.md) и [calculation-logic-flow.md](./calculation-logic-flow.md).
4. [database-schema.md](./database-schema.md).
5. Запись в [consistency-review.md](./consistency-review.md).

---

## История изменений

| Дата | Изменение |
|------|-----------|
| 2026-05 | Первая версия каталога; 16 ставок; 8 подтипов + КП; `poi_fluid_type`, `poi_water_injection_volume`; `eng_oil_preparation`, `eng_well_gathering`; сняты gas_pipeline, collection_point, water_intake, `marine_terminal` (внешний объект) |
| 2026-05 | `infra_object_geometry_type`; `analysis_anchor_*`, `analysis_distance_method`; planned `infra_network_id`, `analysis_nearest_node_id` |
| 2026-05 | `km_per_pad_*` (4); `analysis_distance_source`; internal linear = pads × km/КП; threshold_* → mvp; `project_visibility` |
| 2026-05 | §3.1 таблица subtype → point/linestring (FR-2.3.9) |
