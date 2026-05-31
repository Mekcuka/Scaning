# Импорт Искра → decision-matrix (маппинг типов)

Экспорт Искра (`type: "project"`, `data.objects[]`, CRS в `data.projection`) преобразуется в объекты `infrastructure_objects` с подтипами DM.

**Дата:** май 2026.

## Системы координат

| Источник | Назначение |
|----------|------------|
| `data.projection.name` (напр. `crs:32643`) | EPSG:32643 UTM zone 43N |
| WGS84 `lon`, `lat` (SRID 4326) | БД и карта OpenLayers |

Преобразование: **pyproj** (`Transformer.from_crs(src_epsg, 4326)`).

## Правила геометрии

| Геометрия Искра | Действие |
|-----------------|----------|
| `properties.x` / `y` (без линии) | Point → подтип точки |
| `properties.geometry` LineString | LineString в WGS84, все вершины |
| `properties.geometry` Polygon | **Центроид** кольца → Point (MVP: полигоны на карте не хранятся) |
| Нет координат / неизвестный тип | Пропуск с записью в `errors` |

> У Искра полигон часто задан как `coordinates: [[x,y], ...]` (одно кольцо), не как GeoJSON `[[[x,y],...]]`.

## Таблица маппинга (44 типа)

| Искра `type` | `subtype` DM | `category` | Геометрия | Примечание |
|--------------|--------------|------------|-----------|------------|
| **Узлы сети** |
| `ProductionJoint` | `node` | `network` | Point (x,y) | Узел нефтесбора |
| `GasJoint` | `node` | `network` | Point | Узел газа |
| `RoadJoint` | `node` | `network` | Point | Узел дорог |
| `MethanolJoint` | `methanol_joint` | `network` | Point | Узел метанола |
| `AdditionalJoint` | `node` | `network` | Point | Прочий узел |
| **Линии** |
| `InFieldProductionPipeLine` | `oil_pipeline` | `pipeline` | LineString | Внутриплощадочный нефтепровод |
| `TransmissionProductionPipeLine` | `oil_pipeline` | `pipeline` | LineString | Магистральный нефтепровод |
| `GasLine` | `gas_pipeline` | `pipeline` | LineString | Газопровод |
| `LowPressureInjectionPipeLine` | `water_pipeline` | `pipeline` | LineString | Низконапорная закачка → условно водопровод |
| `HighPressureInjectionPipeLine` | `water_pipeline` | `pipeline` | LineString | Высоконапорная закачка |
| `RoadLine` | `autoroad` | `road` | LineString | Автодорога |
| `SingleWiredEnergeticsLine` | `power_line` | `electricity` | LineString | Одноцепная ЛЭП |
| `DoubleWiredEnergeticsLine` | `power_line` | `electricity` | LineString | Двухцепная ЛЭП |
| `MethanolPipeLine` | `methanol_pipeline` | `pipeline` | LineString | |
| `AdditionalLine` | `additional_line` | `other` | LineString | Доп. линия |
| **Площадные → точка (центроид)** |
| `CentralGatheringFacility` | `gas_processing` | `area_facility` | Polygon→Point | ЦПС |
| `CentralProcessingFacility` | `refinery` | `area_facility` | Polygon→Point | УПН |
| `DeliveryAcceptancePoint` | `refinery` | `area_facility` | Polygon→Point | ПСП → НПЗ |
| `GasProcessingFacility` | `ukg` | `area_facility` | Polygon→Point | УКГ |
| `GasDeliveryFacility` | `tsg` | `area_facility` | Polygon→Point | ТСГ |
| `GasCompressorStation` | `gtes` | `area_facility` | Polygon→Point | КС → ГТЭС |
| `CaptivePowerPlant` | `gpes` | `area_facility` | Polygon→Point | ПЭС → ГПЭС |
| `PowerSource` | `substation` | `electricity` | Polygon→Point | Источник питания |
| `SingleSubstationKit` | `substation` | `electricity` | Polygon→Point | ПС |
| `DoubleSubstationKit` | `substation` | `electricity` | Polygon→Point | ПС |
| `SingleStepUpSubstation` | `substation` | `electricity` | Polygon→Point | ПС повышения |
| `DoubleStepUpSubstation` | `substation` | `electricity` | Polygon→Point | |
| `SingleStepDownSubstation` | `substation` | `electricity` | Polygon→Point | ПС понижения |
| `DoubleStepDownSubstation` | `substation` | `electricity` | Polygon→Point | |
| `DrillingSubstationKit` | `substation` | `electricity` | Polygon→Point | Буровая ПС |
| `SingleAutomaticControlStation` | `substation` | `electricity` | Polygon→Point | АСУ ТП |
| `DoubleAutomaticControlStation` | `substation` | `electricity` | Polygon→Point | |
| `Pad` | `pad` | `pad` | Polygon→Point | `properties.spark_type`, `spark_pad_type`, `name` |
| `GasUtilizingWellsPad` | `pad` | `pad` | Polygon→Point | |
| `GasWellsPad` | `pad` | `pad` | Polygon→Point | |
| `WaterUtilizingWellsPad` | `pad` | `pad` | Polygon→Point | |
| `WaterSupplier` | `pad` | `pad` | Polygon→Point | Водоснабжение → куст |
| `PreliminaryWaterDischargeStation` | `preliminary_water_discharge_station` | `area_facility` | Polygon→Point | УПСВ |
| `BoosterPumpingStation` | `booster_pumping_station` | `area_facility` | Polygon→Point | ДНС |
| `OilPumpingStation` | `oil_pumping_station` | `area_facility` | Polygon→Point | НПС |
| `GroundPumpingStation` | `ground_pumping_station` | `area_facility` | Polygon→Point | БКНС |
| `Sandpit` | `sand_quarry` | `area_facility` | Polygon→Point | Карьер песка |
| `MethanolFacility` | `methanol_facility` | `area_facility` | Polygon→Point | |
| `AdditionalFacility` | `additional_facility` | `area_facility` | Polygon→Point | Доп. объект |
| `Offplot` | `offplot` | `area_facility` | Polygon→Point | ВО (внеплощадочный объект) |

## Импорт линий и валидация концов

При обычном импорте CSV/GeoJSON каждая линия проверяется: концы должны быть в **300 м** от любого точечного объекта инфраструктуры (см. `line_endpoint_rules.py`). После проверки концы **подставляются** в точные `lon`/`lat` объекта (`snap_line_endpoints_to_point_objects`); координаты вершин в БД не округляются до 3 знаков.

В экспорте Искра концы труб привязаны к узлам Искра (`begin-node` / `end-node`), а не к нашим подтипам; геометрически до ближайшего импортированного узла часто **> 300 м**. Поэтому для **`format=spark`** эта проверка **отключена** — на карту попадают все распознанные LineString.

## API и инструменты

| Компонент | Путь |
|-----------|------|
| Парсер | `backend/app/services/spark_import.py` |
| Словарь | `backend/app/geo/spark_mapping.py` |
| Импорт | `POST /api/v1/projects/{id}/import/spark` |
| Конвертер CLI | `decision-matrix/scripts/spark_export_to_geojson.py` |

## Связанные документы

- [map-objects-and-spatial-calculations.md](./map-objects-and-spatial-calculations.md) — подтипы на карте
- [input-parameters.md](./input-parameters.md) — FR-2.5.3 импорт файлов
