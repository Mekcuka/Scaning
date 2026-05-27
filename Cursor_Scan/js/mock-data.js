const SUBTYPE_META = {
  autoroad: { symbol: "D", icon: "route", color: "#78909c", label: "Автодорога", category: "linear" },
  oil_pipeline: { symbol: "N", icon: "fuel", color: "#5d4037", label: "Нефтепровод", category: "linear" },
  water_pipeline: { symbol: "W", icon: "droplets", color: "#0288d1", label: "Водопровод", category: "linear" },
  power_line: { symbol: "E", icon: "zap", color: "#fbc02d", label: "ЛЭП", category: "linear" },
  gas_processing: { symbol: "K", icon: "factory", color: "#ff6f00", label: "ГКС", category: "area" },
  gtes: { symbol: "T", icon: "flame", color: "#d84315", label: "ГТЭС", category: "area" },
  substation: { symbol: "P", icon: "plug-zap", color: "#f9a825", label: "ПС/ТП", category: "area" },
  refinery: { symbol: "R", icon: "building-2", color: "#455a64", label: "НПЗ", category: "area" },
};

const ANALYSIS_BASE = [
  { subtype: "Автодорога", distance: 45, limit: 50, status: "within_limit", object: "Автодорога М-11" },
  { subtype: "Водопровод", distance: 25, limit: 30, status: "within_limit", object: "Водовод-2" },
  { subtype: "ГКС", distance: 92, limit: 80, status: "exceeds_limit", object: "ГКС Восток" },
  { subtype: "ПС / ТП", distance: 22, limit: 25, status: "within_limit", object: "ПС-110" },
  { subtype: "ЛЭП", distance: 28, limit: 30, status: "construction_required", object: "—" },
];

const MOCK = {
  user: { name: "Иванов И.И.", email: "engineer@oilgas.ru", role: "Analyst" },

  projects: [
    { id: "p1", name: "Участок Западный", description: "Разработка западного участка", poiCount: 3, status: "active", date: "15.01.2024", totalCost: 1659 },
    { id: "p2", name: "Участок Восточный", description: "Пилотный проект", poiCount: 5, status: "analysis", date: "14.01.2024", totalCost: 3420 },
    { id: "p3", name: "Северное месторождение", description: "Предпроектные изыскания", poiCount: 1, status: "draft", date: "10.01.2024", totalCost: null },
  ],

  poi: {
    id: "poi1",
    name: "Точка интереса 1",
    projectId: "p1",
    coords: [55.7558, 37.6176],
    fluidType: "oil",
    volume: 50,
    waterInjectionVolume: 0,
    wellsPerPad: 4,
    productionPerWell: 10,
    pads: 2,
    power: "external",
    injection: "centralized",
    gas: "well",
    oilPreparation: "mkos",
    wellGathering: "single_tube",
    transport: "auto",
  },

  variants: [
    { id: "base", name: "Базовый", type: "base", total: 1659, status: "exceeds_limit", selected: true },
    { id: "s1", name: "Сценарий 1", type: "scenario", total: 1759, status: "exceeds_limit", manual: false },
    { id: "s2", name: "Сценарий 2 ✏️", type: "scenario", total: 3055, status: "within_limit", manual: true },
  ],

  criteria: [
    { name: "Общая стоимость", type: "cost", unit: "млн ₽", weight: 0.35 },
    { name: "Общее расстояние", type: "cost", unit: "км", weight: 0.15 },
    { name: "Количество превышений", type: "cost", unit: "шт.", weight: 0.2 },
    { name: "Риск реализации", type: "cost", unit: "1-10", weight: 0.1 },
    { name: "Время реализации", type: "cost", unit: "мес.", weight: 0.1 },
    { name: "Надёжность инфраструктуры", type: "benefit", unit: "1-10", weight: 0.1 },
  ],

  ranking: [
    { name: "Сценарий 2", score: 0.72, rank: 1 },
    { name: "Базовый", score: 0.58, rank: 2 },
    { name: "Сценарий 1", score: 0.51, rank: 3 },
  ],

  infraObjects: [
    { id: "io1", name: "Автодорога М-11", subtype: "autoroad", lat: 55.82, lon: 37.55, color: "#78909c" },
    { id: "io2", name: "Нефтепровод Север", subtype: "oil_pipeline", lat: 55.74, lon: 37.70, color: "#5d4037" },
    { id: "io4", name: "ГКС Восток", subtype: "gas_processing", lat: 55.68, lon: 37.65, color: "#ff6f00" },
    { id: "io5", name: "ПС-110", subtype: "substation", lat: 55.76, lon: 37.58, color: "#fbc02d" },
    { id: "io7", name: "ГТЭС-1", subtype: "gtes", lat: 55.72, lon: 37.62, color: "#d84315" },
  ],

  layers: [
    { id: "roads", name: "Дороги", visible: true, layerRef: "roads" },
    { id: "pipelines", name: "Трубопроводы", visible: true, layerRef: "pipelines" },
    { id: "areas", name: "Площадные объекты", visible: true, layerRef: "areas" },
    { id: "poi", name: "Точки интереса", visible: true, layerRef: "poi" },
  ],

  radii: [
    { id: "r_autoroad", name: "Автодорога 50 км", subtype: "autoroad", checked: true, color: "#9e9e9e", km: 50 },
    { id: "r_power", name: "ЛЭП 30 км", subtype: "power_line", checked: true, color: "#fbc02d", km: 30 },
    { id: "r_gks", name: "ГКС 80 км", subtype: "gas_processing", checked: true, color: "#ff6f00", km: 80 },
  ],

  analysis: ANALYSIS_BASE,

  scenarioAnalysis: {
    base: ANALYSIS_BASE,
    s1: [
      { subtype: "Автодорога", distance: 45, limit: 50, status: "within_limit", object: "Автодорога М-11" },
      { subtype: "Водопровод", distance: 25, limit: 30, status: "within_limit", object: "Водовод-2" },
      { subtype: "ГКС", distance: 88, limit: 80, status: "exceeds_limit", object: "ГКС Восток" },
      { subtype: "ПС / ТП", distance: 22, limit: 25, status: "within_limit", object: "ПС-110" },
      { subtype: "ЛЭП", distance: 28, limit: 30, status: "within_limit", object: "ЛЭП-35" },
    ],
    s2: [
      { subtype: "Автодорога", distance: 45, limit: 50, status: "within_limit", object: "Автодорога М-11" },
      { subtype: "Водопровод", distance: 25, limit: 30, status: "within_limit", object: "Водовод-2" },
      { subtype: "ГКС", distance: 75, limit: 80, status: "within_limit", object: "ГКС Альтернатива" },
      { subtype: "ПС / ТП", distance: 22, limit: 25, status: "within_limit", object: "ПС-110" },
      { subtype: "Нефтепровод", distance: 120, limit: 100, status: "within_limit", object: "НПЗ Север" },
    ],
  },

  sampleImportRows: [
    { name: "Дорога Север", type: "autoroad", lat: 55.81, lon: 37.52, error: null },
    { name: "ЛЭП-110", type: "power_line", lat: 55.77, lon: 37.6, error: null },
    { name: "ГКС-2", type: "gas_processing", lat: 55.69, lon: 37.62, error: null },
    { name: "Объект X", type: "unknown_type", lat: 55.75, lon: 37.55, error: "Неизвестный подтип" },
    { name: "Труба Юг", type: "oil_pipeline", lat: "", lon: 37.68, error: "Нет координаты lat" },
    { name: "ГТЭС-2", type: "gtes", lat: 55.731, lon: 37.481, error: null },
    { name: "ПС Юг", type: "substation", lat: 55.71, lon: 37.51, error: null },
  ],

  onePager: {
    title: "УЧАСТОК ЗАПАДНЫЙ",
    date: "15.01.2024",
    coords: "55.7558, 37.6176",
    engineer: "Иванов И.И.",
    variant: "Базовый",
    total: "1 659 млн ₽",
    recommendation:
      "Рекомендуется базовый вариант. Внимание: ГКС превышает лимит на 12 км. Рассмотреть альтернативный ГКС или строительство собственной газопереработки.",
  },
};

function getAnalysisForVariant(variantIndex) {
  const v = MOCK.variants[variantIndex];
  if (!v) return MOCK.analysis;
  return MOCK.scenarioAnalysis[v.id] || MOCK.analysis;
}
