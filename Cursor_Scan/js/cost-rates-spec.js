/**
 * Ставки стоимости проекта (FR-4.1.2)
 * Значения хранятся и вводятся в тыс. рублей.
 * 16 показателей.
 */
const COST_RATE_UNIT_LABELS = {
  per_km: "тыс. ₽/км",
  fixed: "тыс. ₽",
  per_unit: "тыс. ₽/шт.",
};

function getUnitLabel(unit) {
  return COST_RATE_UNIT_LABELS[unit] ?? unit;
}

const COST_RATE_GROUPS = [
  {
    id: "linear_internal",
    label: "Линейные внутренние (Inside POI)",
    fr: "FR-4.1.2",
    unit: "per_km",
    rows: [
      { id: "autoroad", label: "Автодорога", defaultValue: 5000 },
      { id: "oil_pipeline", label: "Нефтепровод", defaultValue: 8000 },
      { id: "water_pipeline", label: "Водопровод", defaultValue: 6000 },
      { id: "power_line", label: "ЛЭП", defaultValue: 3000 },
    ],
  },
  {
    id: "area_external",
    label: "Площадные внешние (Outside POI)",
    fr: "FR-4.1.2",
    unit: "fixed",
    rows: [
      { id: "gas_processing", label: "ГКС", defaultValue: 500000 },
      { id: "gtes", label: "ГТЭС / ГПЭС", defaultValue: 600000 },
      { id: "substation", label: "ПС / ТП", defaultValue: 200000 },
      { id: "refinery", label: "НПЗ", defaultValue: 0 },
    ],
  },
  {
    id: "pads",
    label: "Кустовые площадки",
    fr: "FR-4.1.2, FR-5.3.2",
    unit: "per_unit",
    rows: [{ id: "pads", label: "Кустовая площадка", defaultValue: 200000 }],
  },
  {
    id: "engineering",
    label: "Инженерное оборудование",
    fr: "FR-4.1.2, FR-7.3.4",
    unit: "fixed",
    rows: [
      { id: "eq_power", label: "Электроснабжение — внутреннее (ГТЭС/ГПЭС)", defaultValue: 450000 },
      { id: "eq_injection", label: "Закачка — локальная (насосная)", defaultValue: 150000 },
      { id: "eq_gas", label: "Утилизация газа — электрогенерация (ГПЭС/ГТУ)", defaultValue: 0 },
      { id: "eq_mkos", label: "Подготовка нефти — МКОС", defaultValue: 100000 },
      { id: "eq_bmupn", label: "Подготовка нефти — БМУПН", defaultValue: 120000 },
      { id: "eq_cps", label: "Подготовка нефти — ЦПС(УПН)", defaultValue: 150000 },
      { id: "eq_upsv", label: "Подготовка нефти — УПСВ", defaultValue: 130000 },
    ],
  },
];

/** Стоимость подготовки нефти в матрице (млн ₽) по индексу опции */
const OIL_PREP_COST_MLN = [100, 120, 150, 130, 0];

const OIL_PREP_RATE_IDS = ["eq_mkos", "eq_bmupn", "eq_cps", "eq_upsv"];

function buildDefaultCostRates() {
  const rates = {};
  COST_RATE_GROUPS.forEach((g) => {
    g.rows.forEach((r) => {
      rates[r.id] = r.defaultValue;
    });
  });
  return rates;
}

const DEFAULT_COST_RATES = buildDefaultCostRates();

function storageKey(projectId) {
  return `dm-cost-rates-${projectId}`;
}

function getCostRates(projectId) {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (!raw) return { ...DEFAULT_COST_RATES };
    return { ...DEFAULT_COST_RATES, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_COST_RATES };
  }
}

function saveCostRates(projectId, rates) {
  localStorage.setItem(storageKey(projectId), JSON.stringify(rates));
}

function resetCostRates(projectId) {
  localStorage.removeItem(storageKey(projectId));
  return { ...DEFAULT_COST_RATES };
}

function oilPreparationCostMln(prepIndex, rates) {
  if (prepIndex >= 4) return 0;
  const id = OIL_PREP_RATE_IDS[prepIndex];
  const thousand = rates?.[id] ?? DEFAULT_COST_RATES[id] ?? 0;
  return Math.round(thousand / 10) / 100;
}
