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

export { SUBTYPE_LABELS } from './api';

export const STATUS_LABELS: Record<string, string> = {
  within_limit: 'В пределах',
  exceeds_limit: 'Превышение',
  not_required: 'Не требуется',
  construction_required: 'Строительство',
  computed: 'Расчёт',
};
