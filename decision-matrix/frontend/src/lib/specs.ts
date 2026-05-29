export const COST_RATE_GROUPS = [
  {
    id: 'linear_internal',
    label: 'Линейные внутренние (Inside POI)',
    unit: 'per_km',
    unitLabel: 'тыс. ₽/км',
    rows: [
      { id: 'autoroad', label: 'Автодорога', defaultValue: 5000 },
      { id: 'oil_pipeline', label: 'Нефтепровод', defaultValue: 8000 },
      { id: 'water_pipeline', label: 'Водопровод', defaultValue: 6000 },
      { id: 'power_line', label: 'ЛЭП', defaultValue: 3000 },
    ],
  },
  {
    id: 'area_external',
    label: 'Площадные внешние (Outside POI)',
    unit: 'fixed',
    unitLabel: 'тыс. ₽',
    rows: [
      { id: 'gas_processing', label: 'ГКС', defaultValue: 500000 },
      { id: 'gtes', label: 'ГТЭС / ГПЭС', defaultValue: 600000 },
      { id: 'substation', label: 'ПС / ТП', defaultValue: 200000 },
      { id: 'refinery', label: 'НПЗ', defaultValue: 0 },
      { id: 'ground_pumping_station', label: 'БКНС', defaultValue: 400000 },
    ],
  },
  {
    id: 'pads',
    label: 'Кустовые площадки',
    unit: 'per_unit',
    unitLabel: 'тыс. ₽/шт.',
    rows: [{ id: 'pads', label: 'Кустовая площадка', defaultValue: 200000 }],
  },
  {
    id: 'engineering',
    label: 'Инженерное оборудование',
    unit: 'fixed',
    unitLabel: 'тыс. ₽',
    rows: [
      { id: 'eq_power', label: 'Электроснабжение — внутреннее', defaultValue: 450000 },
      { id: 'eq_injection', label: 'Закачка — локальная', defaultValue: 150000 },
      { id: 'eq_gas', label: 'Утилизация газа — электрогенерация', defaultValue: 0 },
      { id: 'eq_mkos', label: 'Подготовка нефти — МКОС', defaultValue: 100000 },
      { id: 'eq_bmupn', label: 'Подготовка нефти — БМУПН', defaultValue: 120000 },
      { id: 'eq_cps', label: 'Подготовка нефти — ЦПС(УПН)', defaultValue: 150000 },
      { id: 'eq_upsv', label: 'Подготовка нефти — УПСВ', defaultValue: 130000 },
    ],
  },
];

export function buildDefaultRates(): Record<string, number> {
  const rates: Record<string, number> = {};
  COST_RATE_GROUPS.forEach((g) => g.rows.forEach((r) => (rates[r.id] = r.defaultValue)));
  return rates;
}

export const ECONOMIC_PARAM_GROUPS = [
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
    label: 'OPEX терминалов',
    unitLabel: 'тыс. ₽/год',
    rows: [
      { id: 'opex_refinery', label: 'НПЗ / НПС', defaultValue: 15000 },
      { id: 'opex_gas_processing', label: 'ГКС', defaultValue: 12000 },
      { id: 'opex_gtes', label: 'ГТЭС', defaultValue: 14000 },
      { id: 'opex_gpes', label: 'ГПЭС', defaultValue: 14000 },
      { id: 'opex_vies', label: 'ВИЭС', defaultValue: 14000 },
      { id: 'opex_substation', label: 'ПС / ТП', defaultValue: 8000 },
      { id: 'opex_ground_pumping_station', label: 'БКНС', defaultValue: 7000 },
    ],
  },
];

export function buildDefaultEconomicParams(): Record<string, number> {
  const params: Record<string, number> = {};
  ECONOMIC_PARAM_GROUPS.forEach((g) => g.rows.forEach((r) => (params[r.id] = r.defaultValue)));
  return params;
}

export { SUBTYPE_LABELS } from './api';

export const STATUS_LABELS: Record<string, string> = {
  within_limit: 'В пределах',
  exceeds_limit: 'Превышение',
  not_required: 'Не требуется',
  construction_required: 'Строительство',
  computed: 'Расчёт',
};
