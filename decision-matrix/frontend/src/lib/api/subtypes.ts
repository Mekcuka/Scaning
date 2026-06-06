import type { InfraObject } from './entities';

/** Legacy DB/API subtype codes → current codes (keep in sync with backend constants.py). */
export const LEGACY_SUBTYPE_ALIASES: Record<string, string> = {
  pad: 'oil_pad',
};

export function normalizeInfraSubtype(subtype: string): string {
  const st = subtype.trim().toLowerCase();
  return LEGACY_SUBTYPE_ALIASES[st] ?? st;
}

export const POINT_SUBTYPES = [
  'gas_processing',
  'ukg',
  'tsg',
  'gtes',
  'gpes',
  'vies',
  'substation',
  'refinery',
  'node',
  'oil_pad',
  'gas_pad',
  'preliminary_water_discharge_station',
  'booster_pumping_station',
  'oil_pumping_station',
  'ground_pumping_station',
  'sand_quarry',
  'methanol_facility',
  'methanol_joint',
  'power_line_node',
  'offplot',
  'additional_facility',
] as const;

/** Map/import layer filter (includes gas_pipeline). */
export const LINE_SUBTYPES = [
  'autoroad',
  'oil_pipeline',
  'gas_pipeline',
  'water_pipeline',
  'power_line',
  'methanol_pipeline',
  'additional_line',
] as const;

export const ALL_MAP_SUBTYPES = [...POINT_SUBTYPES, ...LINE_SUBTYPES] as const;

/** FR-6: 4 internal linear subtypes in environment analysis. */
export const ANALYSIS_LINE_SUBTYPES = ['autoroad', 'oil_pipeline', 'water_pipeline', 'power_line'] as const;
/** Nearest vertex/node on map for all drawable line subtypes. */
export const EXTERNAL_LINEAR_SUBTYPES = LINE_SUBTYPES;

export const SUBTYPE_LABELS: Record<string, string> = {
  autoroad: 'Автодорога',
  oil_pipeline: 'Нефтепровод',
  gas_pipeline: 'Газопровод',
  water_pipeline: 'Водопровод',
  power_line: 'ЛЭП',
  methanol_pipeline: 'Метанолопровод',
  gas_processing: 'ГКС',
  ukg: 'УКГ',
  tsg: 'ТСГ',
  gtes: 'ГТЭС',
  gpes: 'ГПЭС',
  vies: 'ВИЭС',
  substation: 'ПС/ТП',
  refinery: 'НПЗ',
  node: 'Узел',
  oil_pad: 'Нефтяной куст',
  gas_pad: 'Газовый куст',
  preliminary_water_discharge_station: 'УПСВ',
  booster_pumping_station: 'ДНС',
  oil_pumping_station: 'НПС',
  ground_pumping_station: 'БКНС',
  sand_quarry: 'Карьер песка',
  methanol_facility: 'Объект метанола',
  methanol_joint: 'Узел метанола',
  power_line_node: 'Узел ЛЭП',
  additional_line: 'Доп. линия',
  additional_facility: 'Доп. объект',
  offplot: 'ВО',
};

export function createDefaultSubtypeFilter(): Record<string, boolean> {
  return Object.fromEntries(ALL_MAP_SUBTYPES.map((s) => [s, true]));
}

/** ГКС + УКГ + ТСГ — смена подтипа только внутри этой группы. */
export const GKS_CLUSTER_SUBTYPES = ['gas_processing', 'ukg', 'tsg'] as const;

/** Узел + узел метанола + узел ЛЭП — смена подтипа только внутри группы. */
export const NODE_CLUSTER_SUBTYPES = ['node', 'methanol_joint', 'power_line_node'] as const;

/** Нефтяной / газовый куст — смена подтипа только внутри пары. */
export const PAD_CLUSTER_SUBTYPES = ['oil_pad', 'gas_pad'] as const;

/** Подпись в меню «Точка» (если отличается от SUBTYPE_LABELS). */
export const POINT_MENU_LABELS: Partial<Record<string, string>> = {
  gtes: 'ИЭ',
  oil_pad: 'Куст',
};

export function pointMenuLabel(subtype: string): string {
  return POINT_MENU_LABELS[subtype] ?? SUBTYPE_LABELS[subtype] ?? subtype;
}

/** ГТЭС + ГПЭС + ВИЭС — смена подтипа только внутри группы. */
export const GTES_CLUSTER_SUBTYPES = ['gtes', 'gpes', 'vies'] as const;

export type LayerVisibilityGroup = {
  id: string;
  label: string;
  subtypes: readonly string[];
};

/** Трубопроводы — отдельный переключатель на каждый подтип (панель «Слои»). */
export const PIPELINE_LAYER_VISIBILITY_GROUPS: LayerVisibilityGroup[] = [
  { id: 'oil_pipeline', label: SUBTYPE_LABELS.oil_pipeline, subtypes: ['oil_pipeline'] },
  { id: 'water_pipeline', label: SUBTYPE_LABELS.water_pipeline, subtypes: ['water_pipeline'] },
  { id: 'gas_pipeline', label: SUBTYPE_LABELS.gas_pipeline, subtypes: ['gas_pipeline'] },
  { id: 'methanol_pipeline', label: SUBTYPE_LABELS.methanol_pipeline, subtypes: ['methanol_pipeline'] },
];

export const PIPELINE_LAYER_SUBTYPES = PIPELINE_LAYER_VISIBILITY_GROUPS.flatMap((g) => g.subtypes);

/** Sidebar «Слои» → «Объекты»: each map subtype belongs to exactly one group. */
export const LAYER_VISIBILITY_GROUPS: LayerVisibilityGroup[] = [
  // Точечные объекты
  { id: 'gks', label: 'ГКС / УКГ / ТСГ', subtypes: GKS_CLUSTER_SUBTYPES },
  { id: 'gtes', label: 'ИЭ', subtypes: GTES_CLUSTER_SUBTYPES },
  { id: 'energy', label: 'Подстанции', subtypes: ['substation'] },
  {
    id: 'industrial',
    label: 'НПЗ / насосные',
    subtypes: [
      'refinery',
      'oil_pumping_station',
      'preliminary_water_discharge_station',
      'booster_pumping_station',
      'ground_pumping_station',
    ],
  },
  { id: 'pads_quarry', label: 'Куст и карьер', subtypes: ['oil_pad', 'gas_pad', 'sand_quarry'] },
  { id: 'offplot', label: 'ВО', subtypes: ['offplot'] },
  { id: 'additional_facility', label: 'Доп. объекты', subtypes: ['additional_facility'] },
  { id: 'methanol_facility', label: 'Объект метанола', subtypes: ['methanol_facility'] },
  { id: 'nodes', label: 'Узлы', subtypes: NODE_CLUSTER_SUBTYPES },
  // Линейные объекты
  { id: 'roads', label: 'Дороги', subtypes: ['autoroad'] },
  ...PIPELINE_LAYER_VISIBILITY_GROUPS,
  { id: 'power_line', label: SUBTYPE_LABELS.power_line, subtypes: ['power_line'] },
  { id: 'additional_linear', label: 'Доп. линии', subtypes: ['additional_line'] },
];

const LINE_SUBTYPE_SET = new Set<string>(LINE_SUBTYPES);

export function layerGroupKind(group: LayerVisibilityGroup): 'point' | 'line' {
  return group.subtypes.every((s) => LINE_SUBTYPE_SET.has(s)) ? 'line' : 'point';
}

export const POINT_LAYER_VISIBILITY_GROUPS = LAYER_VISIBILITY_GROUPS.filter(
  (g) => layerGroupKind(g) === 'point',
);

export const LINE_LAYER_VISIBILITY_GROUPS = LAYER_VISIBILITY_GROUPS.filter(
  (g) => layerGroupKind(g) === 'line',
);

export type LayerVisibilityUiEntry =
  | { kind: 'group'; group: LayerVisibilityGroup }
  | {
      kind: 'subcategory';
      title: string;
      groups: readonly LayerVisibilityGroup[];
      subtypes: readonly string[];
    };

function lineVisibilityGroup(id: string): LayerVisibilityGroup {
  const group = LINE_LAYER_VISIBILITY_GROUPS.find((g) => g.id === id);
  if (!group) throw new Error(`Unknown line layer group: ${id}`);
  return group;
}

/** Порядок и вложенность линейных групп в панели «Слои». */
export const LINE_LAYER_UI_ENTRIES: LayerVisibilityUiEntry[] = [
  { kind: 'group', group: lineVisibilityGroup('roads') },
  {
    kind: 'subcategory',
    title: 'Трубопроводы',
    groups: PIPELINE_LAYER_VISIBILITY_GROUPS,
    subtypes: PIPELINE_LAYER_SUBTYPES,
  },
  { kind: 'group', group: lineVisibilityGroup('power_line') },
  { kind: 'group', group: lineVisibilityGroup('additional_linear') },
];

export const POINT_LAYER_UI_ENTRIES: LayerVisibilityUiEntry[] = POINT_LAYER_VISIBILITY_GROUPS.map(
  (group) => ({ kind: 'group', group }),
);

const GKS_CLUSTER_SET = new Set<string>(GKS_CLUSTER_SUBTYPES);
const NODE_CLUSTER_SET = new Set<string>(NODE_CLUSTER_SUBTYPES);
const PAD_CLUSTER_SET = new Set<string>(PAD_CLUSTER_SUBTYPES);
const GTES_CLUSTER_SET = new Set<string>(GTES_CLUSTER_SUBTYPES);

export function isGksClusterSubtype(subtype: string): boolean {
  return GKS_CLUSTER_SET.has(subtype);
}

export function isNodeClusterSubtype(subtype: string): boolean {
  return NODE_CLUSTER_SET.has(subtype);
}

export function isPadClusterSubtype(subtype: string): boolean {
  return PAD_CLUSTER_SET.has(subtype);
}

export function isGtesClusterSubtype(subtype: string): boolean {
  return GTES_CLUSTER_SET.has(subtype);
}

/** Point subtypes that cannot be changed after the object is created. */
export const IMMUTABLE_POINT_SUBTYPES = [
  'sand_quarry',
  'ground_pumping_station',
  'oil_pumping_station',
  'methanol_facility',
  'offplot',
  'additional_facility',
] as const;

/** Не в меню «Точка»: Искра, facility-objects API или смена у базового подтипа (см. paste plan). */
export const IMPORT_ONLY_POINT_SUBTYPES = [
  'ukg',
  'tsg',
  'gpes',
  'vies',
  'oil_pumping_station',
  'methanol_joint',
  'power_line_node',
  'gas_pad',
] as const;

/** Подтип куста без пункта «Точка» — импорт Искра или смена у «Куст» (oil_pad). */
export const PAD_DERIVED_POINT_SUBTYPES = ['gas_pad'] as const;

const IMPORT_ONLY_POINT_SET = new Set<string>(IMPORT_ONLY_POINT_SUBTYPES);

/** Нельзя выбрать в карточке другого объекта (кроме самого подтипа). */
export const EXCLUSIVE_POINT_SUBTYPES = ['sand_quarry', 'methanol_facility', 'offplot', 'additional_facility'] as const;

const EXCLUSIVE_POINT_SET = new Set<string>(EXCLUSIVE_POINT_SUBTYPES);

export const MAP_DRAWABLE_POINT_SUBTYPES = POINT_SUBTYPES.filter(
  (s) => !IMPORT_ONLY_POINT_SET.has(s),
);

export function isImmutablePointSubtype(subtype: string): boolean {
  return (IMMUTABLE_POINT_SUBTYPES as readonly string[]).includes(subtype);
}

/** Subtype options for ObjectDetailPanel / edits (respects line vs point and immutable subtypes). */
export function infraSubtypeSelectOptions(object: InfraObject): { value: string; label: string }[] {
  if (isImmutablePointSubtype(object.subtype)) {
    return [{ value: object.subtype, label: SUBTYPE_LABELS[object.subtype] || object.subtype }];
  }
  if (isGksClusterSubtype(object.subtype)) {
    return GKS_CLUSTER_SUBTYPES.map((value) => ({
      value,
      label: SUBTYPE_LABELS[value] || value,
    }));
  }
  if (isNodeClusterSubtype(object.subtype)) {
    return NODE_CLUSTER_SUBTYPES.map((value) => ({
      value,
      label: SUBTYPE_LABELS[value] || value,
    }));
  }
  if (isPadClusterSubtype(object.subtype)) {
    return PAD_CLUSTER_SUBTYPES.map((value) => ({
      value,
      label: SUBTYPE_LABELS[value] || value,
    }));
  }
  if (isGtesClusterSubtype(object.subtype)) {
    return GTES_CLUSTER_SUBTYPES.map((value) => ({
      value,
      label: SUBTYPE_LABELS[value] || value,
    }));
  }
  const isLine =
    (LINE_SUBTYPES as readonly string[]).includes(object.subtype) ||
    (object.coordinates != null && object.coordinates.length >= 2) ||
    (object.end_lon != null && object.end_lat != null);
  const keys = isLine
    ? LINE_SUBTYPES
    : POINT_SUBTYPES.filter(
        (s) =>
          !IMPORT_ONLY_POINT_SET.has(s) &&
          !EXCLUSIVE_POINT_SET.has(s) &&
          !GTES_CLUSTER_SET.has(s) &&
          !NODE_CLUSTER_SET.has(s) &&
          !PAD_CLUSTER_SET.has(s),
      );
  return keys.map((value) => ({ value, label: SUBTYPE_LABELS[value] || value }));
}
