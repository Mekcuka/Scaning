import type { DistanceDefaults, POI } from './api';
import { ANALYSIS_LINE_SUBTYPES, SUBTYPE_LABELS } from './api';
import { formatCoord, parseCoord } from './coords';

export type PoiFormValues = {
  name: string;
  description: string;
  lon: string;
  lat: string;
  fluid_type: 'oil' | 'gas';
  planned_production_volume: number;
  water_injection_volume: number;
  production_per_well: number;
  wells_per_pad: number;
  eng_power: string;
  eng_injection: string;
  eng_gas: string;
  eng_oil_preparation: string;
  eng_well_gathering: string;
  eng_transport: string;
  threshold_gas_processing_km: string;
  threshold_gtes_km: string;
  threshold_substation_km: string;
  threshold_refinery_km: string;
  max_total_line_autoroad_km: string;
  max_total_line_oil_pipeline_km: string;
  max_total_line_gas_pipeline_km: string;
  max_total_line_water_pipeline_km: string;
  max_total_line_power_line_km: string;
  km_per_pad_autoroad: string;
  km_per_pad_oil_pipeline: string;
  km_per_pad_gas_pipeline: string;
  km_per_pad_water_pipeline: string;
  km_per_pad_power_line: string;
};

export type PoiSectionId = 'basic' | 'engineering' | 'thresholds' | 'km_per_pad' | 'max_total_line';

export const POI_SECTION_LABELS: Record<PoiSectionId, string> = {
  basic: 'Добыча и координаты',
  engineering: 'Инженерные параметры',
  thresholds: 'Пороги до внешних объектов (4)',
  km_per_pad: 'Нормы линейной инфраструктуры (км/КП)',
  max_total_line: 'Макс. суммарная длина internal (км)',
};

export const ENG_PARAM_GROUPS = [
  {
    key: 'eng_power' as const,
    label: 'Электроснабжение',
    badgeClass: 'power',
    options: [
      { value: 'external', label: 'Внешнее' },
      { value: 'internal', label: 'Внутреннее' },
    ],
  },
  {
    key: 'eng_injection' as const,
    label: 'Закачка',
    badgeClass: 'injection',
    options: [
      { value: 'centralized', label: 'Централизованная' },
      { value: 'local', label: 'Локальная' },
    ],
  },
  {
    key: 'eng_gas' as const,
    label: 'Утилизация газа',
    badgeClass: 'gas',
    options: [
      { value: 'well', label: 'В пласт' },
      { value: 'flare', label: 'Факел' },
      { value: 'power_generation', label: 'Электрогенерация' },
    ],
  },
  {
    key: 'eng_oil_preparation' as const,
    label: 'Подготовка нефти',
    badgeClass: 'preparation',
    options: [
      { value: 'mkos', label: 'МКОС' },
      { value: 'bmupn', label: 'БМУПН' },
      { value: 'cps', label: 'ЦПС(УПН)' },
      { value: 'upsv', label: 'УПСВ' },
      { value: 'mfns', label: 'МФНС' },
    ],
  },
  {
    key: 'eng_well_gathering' as const,
    label: 'Сбор скважин',
    badgeClass: 'gathering',
    options: [
      { value: 'single_tube', label: 'Однотрубная' },
      { value: 'dual_tube', label: 'Двухтрубная' },
      { value: 'combined', label: 'Комбинированная' },
    ],
  },
  {
    key: 'eng_transport' as const,
    label: 'Транспорт',
    badgeClass: 'transport',
    options: [
      { value: 'auto', label: 'Автовывоз' },
      { value: 'marine', label: 'Морской порт' },
      { value: 'pipeline', label: 'Магистральный' },
    ],
  },
] as const;

export const THRESHOLD_FIELDS = [
  { key: 'threshold_gas_processing_km' as const, label: 'ГКС, км', defaultKey: 'threshold_gas_processing_km' as const },
  { key: 'threshold_gtes_km' as const, label: 'ГТЭС, км', defaultKey: 'threshold_gtes_km' as const },
  { key: 'threshold_substation_km' as const, label: 'ПС, км', defaultKey: 'threshold_substation_km' as const },
  { key: 'threshold_refinery_km' as const, label: 'НПЗ, км', defaultKey: 'threshold_refinery_km' as const },
];

export const KM_PER_PAD_FIELDS = ANALYSIS_LINE_SUBTYPES.map((subtype) => ({
  key: `km_per_pad_${subtype}` as keyof PoiFormValues,
  label: SUBTYPE_LABELS[subtype] || subtype,
  defaultKey: `km_per_pad_${subtype}` as keyof DistanceDefaults,
}));

export const MAX_TOTAL_LINE_FIELDS = ANALYSIS_LINE_SUBTYPES.map((subtype) => ({
  key: `max_total_line_${subtype}_km` as keyof PoiFormValues,
  label: SUBTYPE_LABELS[subtype] || subtype,
  defaultKey: `max_total_line_${subtype}_km` as keyof DistanceDefaults,
}));

export const ENG_LABELS: Record<string, Record<string, string>> = Object.fromEntries(
  ENG_PARAM_GROUPS.map((g) => [g.key, Object.fromEntries(g.options.map((o) => [o.value, o.label]))])
);

export function emptyPoiFormValues(overrides?: Partial<PoiFormValues>): PoiFormValues {
  return {
    name: 'Новая точка',
    description: '',
    lon: '',
    lat: '',
    fluid_type: 'oil',
    planned_production_volume: 50,
    water_injection_volume: 0,
    production_per_well: 10,
    wells_per_pad: 4,
    eng_power: 'external',
    eng_injection: 'centralized',
    eng_gas: 'well',
    eng_oil_preparation: 'mkos',
    eng_well_gathering: 'single_tube',
    eng_transport: 'auto',
    threshold_gas_processing_km: '',
    threshold_gtes_km: '',
    threshold_substation_km: '',
    threshold_refinery_km: '',
    max_total_line_autoroad_km: '',
    max_total_line_oil_pipeline_km: '',
    max_total_line_gas_pipeline_km: '',
    max_total_line_water_pipeline_km: '',
    max_total_line_power_line_km: '',
    km_per_pad_autoroad: '',
    km_per_pad_oil_pipeline: '',
    km_per_pad_gas_pipeline: '',
    km_per_pad_water_pipeline: '',
    km_per_pad_power_line: '',
    ...overrides,
  };
}

export function poiToFormValues(poi: POI): PoiFormValues {
  const num = (v: number | null | undefined) => (v != null ? String(v) : '');
  return {
    name: poi.name,
    description: poi.description || '',
    lon: formatCoord(poi.lon),
    lat: formatCoord(poi.lat),
    fluid_type: poi.fluid_type === 'gas' ? 'gas' : 'oil',
    planned_production_volume: poi.planned_production_volume,
    water_injection_volume: poi.water_injection_volume,
    production_per_well: poi.production_per_well,
    wells_per_pad: poi.wells_per_pad,
    eng_power: poi.eng_power,
    eng_injection: poi.eng_injection,
    eng_gas: poi.eng_gas,
    eng_oil_preparation: poi.eng_oil_preparation,
    eng_well_gathering: poi.eng_well_gathering,
    eng_transport: poi.eng_transport,
    threshold_gas_processing_km: num(poi.threshold_gas_processing_km),
    threshold_gtes_km: num(poi.threshold_gtes_km),
    threshold_substation_km: num(poi.threshold_substation_km),
    threshold_refinery_km: num(poi.threshold_refinery_km),
    max_total_line_autoroad_km: num(poi.max_total_line_autoroad_km),
    max_total_line_oil_pipeline_km: num(poi.max_total_line_oil_pipeline_km),
    max_total_line_gas_pipeline_km: num(poi.max_total_line_gas_pipeline_km),
    max_total_line_water_pipeline_km: num(poi.max_total_line_water_pipeline_km),
    max_total_line_power_line_km: num(poi.max_total_line_power_line_km),
    km_per_pad_autoroad: num(poi.km_per_pad_autoroad),
    km_per_pad_oil_pipeline: num(poi.km_per_pad_oil_pipeline),
    km_per_pad_gas_pipeline: num(poi.km_per_pad_gas_pipeline),
    km_per_pad_water_pipeline: num(poi.km_per_pad_water_pipeline),
    km_per_pad_power_line: num(poi.km_per_pad_power_line),
  };
}

function parseOptionalFloat(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

export function formValuesToPoiPayload(values: PoiFormValues, opts?: { includeCoords?: boolean }) {
  const payload: Record<string, unknown> = {
    name: values.name.trim(),
    description: values.description.trim() || null,
    fluid_type: values.fluid_type,
    planned_production_volume: values.planned_production_volume,
    water_injection_volume: values.water_injection_volume,
    production_per_well: values.production_per_well,
    wells_per_pad: values.wells_per_pad,
    eng_power: values.eng_power,
    eng_injection: values.eng_injection,
    eng_gas: values.eng_gas,
    eng_oil_preparation: values.eng_oil_preparation,
    eng_well_gathering: values.eng_well_gathering,
    eng_transport: values.eng_transport,
  };

  if (opts?.includeCoords !== false) {
    if (values.lon.trim()) payload.lon = parseCoord(values.lon);
    if (values.lat.trim()) payload.lat = parseCoord(values.lat);
  }

  for (const f of THRESHOLD_FIELDS) {
    payload[f.key] = parseOptionalFloat(String(values[f.key]));
  }
  for (const f of KM_PER_PAD_FIELDS) {
    payload[f.key] = parseOptionalFloat(String(values[f.key]));
  }
  for (const f of MAX_TOTAL_LINE_FIELDS) {
    payload[f.key] = parseOptionalFloat(String(values[f.key]));
  }

  return payload;
}

/** Fields accepted by POST /pois (POICreate) — without distance overrides. */
export function formValuesToPoiCreatePayload(values: PoiFormValues) {
  const payload = formValuesToPoiPayload(values, { includeCoords: true });
  const {
    threshold_gas_processing_km: _t1,
    threshold_gtes_km: _t2,
    threshold_substation_km: _t3,
    threshold_refinery_km: _t4,
    max_total_line_autoroad_km: _m1,
    max_total_line_oil_pipeline_km: _m2,
    max_total_line_gas_pipeline_km: _m3,
    max_total_line_water_pipeline_km: _m4,
    max_total_line_power_line_km: _m5,
    km_per_pad_autoroad: _k1,
    km_per_pad_oil_pipeline: _k2,
    km_per_pad_gas_pipeline: _k3,
    km_per_pad_water_pipeline: _k4,
    km_per_pad_power_line: _k5,
    ...createFields
  } = payload;
  return {
    ...createFields,
    wells_per_pad: Math.round(Number(values.wells_per_pad) || 4),
  };
}

export function calcPadsPreview(volume: number, perWell: number, wellsPerPad: number) {
  const wells = perWell > 0 ? volume / perWell : 0;
  const pads = wellsPerPad > 0 ? Math.ceil(wells / wellsPerPad) : 0;
  return { wells, pads };
}

export function engLabel(key: keyof PoiFormValues, value: string): string {
  return ENG_LABELS[key]?.[value] || value;
}

export function defaultHint(
  defaults: DistanceDefaults | undefined,
  key: keyof DistanceDefaults
): string {
  if (!defaults) return '';
  const v = defaults[key];
  return v != null ? `по умолчанию: ${v}` : '';
}
