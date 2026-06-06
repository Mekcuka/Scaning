import type { InfraObject } from './entities';
import {
  ANALYSIS_EXTERNAL_LINEAR_SUBTYPES,
  GKS_CLUSTER_SUBTYPES,
  GTES_CLUSTER_SUBTYPES,
  LEGACY_SUBTYPE_ALIASES,
  LINE_SUBTYPES,
  MANIFEST_EXCLUSIVE_POINT,
  MANIFEST_IMMUTABLE_POINT,
  MANIFEST_PAD_DERIVED_POINT,
  MANIFEST_POINT_MENU_HIDDEN,
  MANIFEST_POINT_MENU_LABELS,
  MANIFEST_SUBTYPE_LABELS,
  NODE_CLUSTER_SUBTYPES,
  PAD_CLUSTER_SUBTYPES,
  POINT_SUBTYPES,
} from './infrastructureSubtypesManifest';

export {
  ANALYSIS_EXTERNAL_LINEAR_SUBTYPES,
  ANALYSIS_EXTERNAL_POINT_SUBTYPES,
  ANALYSIS_LINE_SUBTYPES,
  GKS_CLUSTER_SUBTYPES,
  GTES_CLUSTER_SUBTYPES,
  LEGACY_SUBTYPE_ALIASES,
  LINE_SUBTYPES,
  MANIFEST_IE_DERIVED_POINT,
  MANIFEST_IMPORT_ONLY_POINT,
  MANIFEST_NODE_DERIVED_POINT,
  NODE_CLUSTER_SUBTYPES,
  PAD_CLUSTER_SUBTYPES,
  POINT_SUBTYPES,
} from './infrastructureSubtypesManifest';

export function normalizeInfraSubtype(subtype: string): string {
  const st = subtype.trim().toLowerCase();
  return LEGACY_SUBTYPE_ALIASES[st] ?? st;
}

export const ALL_MAP_SUBTYPES = [...POINT_SUBTYPES, ...LINE_SUBTYPES] as const;

/** Nearest vertex/node on map for all drawable line subtypes (analysis external linear). */
export const EXTERNAL_LINEAR_SUBTYPES = ANALYSIS_EXTERNAL_LINEAR_SUBTYPES;

export const SUBTYPE_LABELS: Record<string, string> = { ...MANIFEST_SUBTYPE_LABELS };

export function createDefaultSubtypeFilter(): Record<string, boolean> {
  return Object.fromEntries(ALL_MAP_SUBTYPES.map((s) => [s, true]));
}

/** Подпись в меню «Точка» (если отличается от SUBTYPE_LABELS). */
export const POINT_MENU_LABELS: Partial<Record<string, string>> = {
  ...MANIFEST_POINT_MENU_LABELS,
};

export function pointMenuLabel(subtype: string): string {
  return POINT_MENU_LABELS[subtype] ?? SUBTYPE_LABELS[subtype] ?? subtype;
}

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
export const IMMUTABLE_POINT_SUBTYPES = [...MANIFEST_IMMUTABLE_POINT] as const;

/** Не в меню «Точка»: import_only + ie_derived из manifest (см. paste plan). */
export const IMPORT_ONLY_POINT_SUBTYPES = [...MANIFEST_POINT_MENU_HIDDEN] as const;

/** Подтип куста без пункта «Точка» — импорт Искра или смена у «Куст» (oil_pad). */
export const PAD_DERIVED_POINT_SUBTYPES = [...MANIFEST_PAD_DERIVED_POINT] as const;

const IMPORT_ONLY_POINT_SET = new Set<string>(IMPORT_ONLY_POINT_SUBTYPES);

/** Нельзя выбрать в карточке другого объекта (кроме самого подтипа). */
export const EXCLUSIVE_POINT_SUBTYPES = [...MANIFEST_EXCLUSIVE_POINT] as const;

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
