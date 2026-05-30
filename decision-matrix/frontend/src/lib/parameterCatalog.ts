/**
 * Единый каталог параметров проекта: расстояния, CAPEX, OPEX.
 * Используется на странице «Ставки» и в формах POI.
 */

import type { DistanceDefaults } from './api';
import { ANALYSIS_LINE_SUBTYPES, LINE_SUBTYPES, SUBTYPE_LABELS } from './api';

export type ParameterRow = {
  id: string;
  label: string;
  defaultValue: number;
};

export type DistanceParameterRow = ParameterRow & {
  distanceKey: keyof DistanceDefaults;
};

export type ParameterGroup = {
  id: string;
  label: string;
  unitLabel: string;
  rows: ParameterRow[];
};

export type DistanceParameterGroup = {
  id: string;
  label: string;
  unitLabel: string;
  rows: DistanceParameterRow[];
};

/** Пороги поиска внешних точечных объектов (км). */
export const EXTERNAL_POINT_THRESHOLD_ROWS: DistanceParameterRow[] = [
  { id: 'threshold_gas_processing_km', distanceKey: 'threshold_gas_processing_km', label: 'ГКС', defaultValue: 80 },
  { id: 'threshold_gtes_km', distanceKey: 'threshold_gtes_km', label: 'ИЭ (ГТЭС/ГПЭС/ВИЭС)', defaultValue: 60 },
  { id: 'threshold_substation_km', distanceKey: 'threshold_substation_km', label: 'ПС / ТП', defaultValue: 25 },
  { id: 'threshold_refinery_km', distanceKey: 'threshold_refinery_km', label: 'НПЗ', defaultValue: 100 },
  {
    id: 'threshold_ground_pumping_station_km',
    distanceKey: 'threshold_ground_pumping_station_km',
    label: 'БКНС',
    defaultValue: 50,
  },
  {
    id: 'threshold_sand_quarry_km',
    distanceKey: 'threshold_sand_quarry_km',
    label: 'Карьер песка',
    defaultValue: 50,
  },
];

const kmPerPadRows = (): DistanceParameterRow[] =>
  ANALYSIS_LINE_SUBTYPES.map((subtype) => ({
    id: `km_per_pad_${subtype}`,
    distanceKey: `km_per_pad_${subtype}` as keyof DistanceDefaults,
    label: SUBTYPE_LABELS[subtype] || subtype,
    defaultValue: 3,
  }));

const maxInternalRows = (): DistanceParameterRow[] =>
  ANALYSIS_LINE_SUBTYPES.map((subtype) => ({
    id: `max_total_line_${subtype}_km`,
    distanceKey: `max_total_line_${subtype}_km` as keyof DistanceDefaults,
    label: SUBTYPE_LABELS[subtype] || subtype,
    defaultValue: subtype === 'autoroad' ? 50 : subtype === 'oil_pipeline' ? 40 : 30,
  }));

const maxExternalLinearRows = (): DistanceParameterRow[] => [
  {
    id: 'max_total_line_gas_pipeline_km',
    distanceKey: 'max_total_line_gas_pipeline_km',
    label: SUBTYPE_LABELS.gas_pipeline,
    defaultValue: 40,
  },
  {
    id: 'max_total_line_methanol_pipeline_km',
    distanceKey: 'max_total_line_methanol_pipeline_km',
    label: SUBTYPE_LABELS.methanol_pipeline,
    defaultValue: 40,
  },
  {
    id: 'max_total_line_additional_line_km',
    distanceKey: 'max_total_line_additional_line_km',
    label: SUBTYPE_LABELS.additional_line,
    defaultValue: 50,
  },
];

export const DISTANCE_PARAMETER_GROUPS: DistanceParameterGroup[] = [
  {
    id: 'external_point_thresholds',
    label: 'Пороги внешних объектов',
    unitLabel: 'км',
    rows: EXTERNAL_POINT_THRESHOLD_ROWS,
  },
  {
    id: 'km_per_pad',
    label: 'Нормы internal (км / куст)',
    unitLabel: 'км/КП',
    rows: kmPerPadRows(),
  },
  {
    id: 'max_internal',
    label: 'Макс. суммарная длина internal',
    unitLabel: 'км',
    rows: maxInternalRows(),
  },
  {
    id: 'max_external_linear',
    label: 'Порог внешних линейных',
    unitLabel: 'км',
    rows: maxExternalLinearRows(),
  },
];

export const CAPEX_RATE_GROUPS: ParameterGroup[] = [
  {
    id: 'linear_per_km',
    label: 'Линейные объекты',
    unitLabel: 'тыс. ₽/км',
    rows: LINE_SUBTYPES.map((subtype) => ({
      id: subtype,
      label: SUBTYPE_LABELS[subtype] || subtype,
      defaultValue:
        subtype === 'autoroad'
          ? 5000
          : subtype === 'oil_pipeline'
            ? 8000
            : subtype === 'gas_pipeline'
              ? 7500
              : subtype === 'water_pipeline'
                ? 6000
                : subtype === 'power_line'
                  ? 3000
                  : subtype === 'methanol_pipeline'
                    ? 5500
                    : 5000,
    })),
  },
  {
    id: 'external_facilities',
    label: 'Внешние площадные объекты',
    unitLabel: 'тыс. ₽',
    rows: [
      { id: 'gas_processing', label: 'ГКС', defaultValue: 500000 },
      { id: 'ukg', label: 'УКГ', defaultValue: 500000 },
      { id: 'tsg', label: 'ТСГ', defaultValue: 500000 },
      { id: 'gtes', label: 'ГТЭС', defaultValue: 600000 },
      { id: 'gpes', label: 'ГПЭС', defaultValue: 600000 },
      { id: 'vies', label: 'ВИЭС', defaultValue: 600000 },
      { id: 'substation', label: 'ПС / ТП', defaultValue: 200000 },
      { id: 'refinery', label: 'НПЗ', defaultValue: 500000 },
      { id: 'oil_pumping_station', label: 'НПС', defaultValue: 400000 },
      { id: 'preliminary_water_discharge_station', label: 'УПСВ', defaultValue: 300000 },
      { id: 'booster_pumping_station', label: 'ДНС', defaultValue: 350000 },
      { id: 'ground_pumping_station', label: 'БКНС', defaultValue: 400000 },
      { id: 'sand_quarry', label: 'Карьер песка', defaultValue: 150000 },
      { id: 'methanol_facility', label: 'Объект метанола', defaultValue: 200000 },
      { id: 'offplot', label: 'ВО', defaultValue: 150000 },
      { id: 'additional_facility', label: 'Доп. объект', defaultValue: 200000 },
    ],
  },
  {
    id: 'pads',
    label: 'Кустовые площадки',
    unitLabel: 'тыс. ₽/шт.',
    rows: [{ id: 'pads', label: 'Кустовая площадка', defaultValue: 200000 }],
  },
  {
    id: 'engineering',
    label: 'Инженерное оборудование',
    unitLabel: 'тыс. ₽',
    rows: [
      { id: 'eq_power', label: 'Электроснабжение — внутреннее', defaultValue: 450000 },
      { id: 'eq_injection', label: 'Закачка — локальная', defaultValue: 150000 },
      { id: 'eq_gas', label: 'Утилизация газа — электрогенерация', defaultValue: 450000 },
      { id: 'eq_mkos', label: 'Подготовка нефти — МКОС', defaultValue: 100000 },
      { id: 'eq_bmupn', label: 'Подготовка нефти — БМУПН', defaultValue: 120000 },
      { id: 'eq_cps', label: 'Подготовка нефти — ЦПС(УПН)', defaultValue: 150000 },
      { id: 'eq_upsv', label: 'Подготовка нефти — УПСВ', defaultValue: 130000 },
    ],
  },
];

export const OPEX_PARAMETER_GROUPS: ParameterGroup[] = [
  {
    id: 'product_prices',
    label: 'Цены продукции',
    unitLabel: 'тыс. ₽',
    rows: [
      { id: 'oil_price_thousand_rub_per_t', label: 'Нефть', defaultValue: 35 },
      { id: 'gas_price_thousand_rub_per_m3', label: 'Газ', defaultValue: 8 },
    ],
  },
  {
    id: 'opex_pipelines',
    label: 'OPEX трубопроводов',
    unitLabel: 'тыс. ₽/км·год',
    rows: [
      { id: 'opex_oil_pipeline_per_km', label: 'Нефтепровод', defaultValue: 120 },
      { id: 'opex_water_pipeline_per_km', label: 'Водопровод', defaultValue: 90 },
      { id: 'opex_gas_pipeline_per_km', label: 'Газопровод', defaultValue: 100 },
      { id: 'opex_methanol_pipeline_per_km', label: 'Метанолопровод', defaultValue: 80 },
      { id: 'opex_additional_line_per_km', label: 'Доп. линия', defaultValue: 70 },
    ],
  },
  {
    id: 'opex_equipment',
    label: 'OPEX оборудования подготовки',
    unitLabel: 'тыс. ₽/год',
    rows: [
      { id: 'opex_eq_mkos', label: 'МКОС', defaultValue: 8000 },
      { id: 'opex_eq_bmupn', label: 'БМУПН', defaultValue: 9000 },
      { id: 'opex_eq_cps', label: 'ЦПС(УПН)', defaultValue: 10000 },
      { id: 'opex_eq_upsv', label: 'УПСВ', defaultValue: 9500 },
      { id: 'opex_eq_injection', label: 'Закачка (локальная)', defaultValue: 6000 },
      { id: 'opex_pads_per_pad', label: 'Кустовая площадка', defaultValue: 5000 },
    ],
  },
  {
    id: 'opex_terminals',
    label: 'OPEX терминалов и площадок',
    unitLabel: 'тыс. ₽/год',
    rows: [
      { id: 'opex_refinery', label: 'НПЗ / НПС', defaultValue: 15000 },
      { id: 'opex_gas_processing', label: 'ГКС', defaultValue: 12000 },
      { id: 'opex_gtes', label: 'ГТЭС', defaultValue: 14000 },
      { id: 'opex_gpes', label: 'ГПЭС', defaultValue: 14000 },
      { id: 'opex_vies', label: 'ВИЭС', defaultValue: 14000 },
      { id: 'opex_substation', label: 'ПС / ТП', defaultValue: 8000 },
      { id: 'opex_ground_pumping_station', label: 'БКНС', defaultValue: 7000 },
      { id: 'opex_sand_quarry', label: 'Карьер песка', defaultValue: 5000 },
      { id: 'opex_offplot', label: 'ВО', defaultValue: 4500 },
      { id: 'opex_additional_facility', label: 'Доп. объект', defaultValue: 5000 },
    ],
  },
];

export function buildDefaultRatesFromCatalog(): Record<string, number> {
  const rates: Record<string, number> = {};
  for (const group of CAPEX_RATE_GROUPS) {
    for (const row of group.rows) {
      rates[row.id] = row.defaultValue;
    }
  }
  return rates;
}

export function buildDefaultEconomicParamsFromCatalog(): Record<string, number> {
  const params: Record<string, number> = {};
  for (const group of OPEX_PARAMETER_GROUPS) {
    for (const row of group.rows) {
      params[row.id] = row.defaultValue;
    }
  }
  return params;
}

export function buildDefaultDistanceDefaults(): DistanceDefaults {
  const out = {} as DistanceDefaults;
  for (const group of DISTANCE_PARAMETER_GROUPS) {
    for (const row of group.rows) {
      out[row.distanceKey] = row.defaultValue;
    }
  }
  return out;
}

/** @deprecated use CAPEX_RATE_GROUPS */
export const COST_RATE_GROUPS = CAPEX_RATE_GROUPS;

/** @deprecated use OPEX_PARAMETER_GROUPS */
export const ECONOMIC_PARAM_GROUPS = OPEX_PARAMETER_GROUPS;
