import type { InfraObject } from './api';
import {
  clampNdsDeg,
  DEFAULT_PAD_HEIGHT_M,
  DEFAULT_PAD_LENGTH_M,
  DEFAULT_PAD_NDS_DEG,
  DEFAULT_PAD_REFERENCE_ELEVATION_M,
  DEFAULT_PAD_WIDTH_M,
  PAD_HEIGHT_M,
  PAD_LENGTH_M,
  PAD_REFERENCE_ELEVATION_M,
  PAD_ROTATION_DEG,
  PAD_WIDTH_M,
} from './infraPadEarthwork';
import { mergePadWellParams, padWellFieldsFromForm, type InfraPadWellDraftStrings } from './infraPadWells';
import {
  mergeCalcSettingsIntoProperties,
  type PadClusteringCalcDraft,
} from './padClusteringCalcSettings';

export type PadClusteringPadDraft = InfraPadWellDraftStrings & {
  lengthM: string;
  widthM: string;
  heightM: string;
  rotationDeg: string;
  referenceElevationM: string;
};

/** Draft fields that affect auto-generated well layout / footprint orientation. */
export const PAD_LAYOUT_DRAFT_KEYS = [
  'padWellCount',
  'padWellsPerGroup',
  'padWellSpacingM',
  'padGroupSpacingM',
  'padMarginLeftM',
  'padMarginBottomM',
  'padMarginTopM',
  'padMarginEndM',
  'rotationDeg',
] as const satisfies readonly (keyof PadClusteringPadDraft)[];

export function isPadLayoutDraftDirty(
  active: PadClusteringPadDraft,
  saved: PadClusteringPadDraft,
): boolean {
  return PAD_LAYOUT_DRAFT_KEYS.some((key) => active[key] !== saved[key]);
}

export function filterPadObjects(objects: InfraObject[]): InfraObject[] {
  return objects.filter((o) => o.subtype === 'oil_pad' || o.subtype === 'gas_pad');
}

function parsePositive(raw: string): number | null {
  const t = raw.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseRef(raw: string): number | null {
  const t = raw.trim().replace(',', '.');
  if (t === '') return DEFAULT_PAD_REFERENCE_ELEVATION_M;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Merge pad well layout + footprint + calculation library params into infrastructure properties. */
export function buildPadClusteringSaveProperties(
  existing: Record<string, unknown> | null | undefined,
  draft: PadClusteringPadDraft,
  calcDraft?: PadClusteringCalcDraft,
): Record<string, unknown> | null {
  const length = parsePositive(draft.lengthM) ?? DEFAULT_PAD_LENGTH_M;
  const width = parsePositive(draft.widthM) ?? DEFAULT_PAD_WIDTH_M;
  const height = parsePositive(draft.heightM) ?? DEFAULT_PAD_HEIGHT_M;
  const ref = parseRef(draft.referenceElevationM);
  if (ref == null) return null;
  const rotRaw = draft.rotationDeg.trim().replace(',', '.');
  const rotation = rotRaw === '' ? DEFAULT_PAD_NDS_DEG : Number(rotRaw);

  const wellFields = padWellFieldsFromForm(draft);
  let props = mergePadWellParams(existing, wellFields);
  props = {
    ...props,
    [PAD_LENGTH_M]: length,
    [PAD_WIDTH_M]: width,
    [PAD_HEIGHT_M]: height,
    [PAD_REFERENCE_ELEVATION_M]: ref,
    [PAD_ROTATION_DEG]: Number.isFinite(rotation) ? clampNdsDeg(rotation) : DEFAULT_PAD_NDS_DEG,
  };
  if (calcDraft) {
    props = mergeCalcSettingsIntoProperties(props, calcDraft);
  }
  return props;
}
