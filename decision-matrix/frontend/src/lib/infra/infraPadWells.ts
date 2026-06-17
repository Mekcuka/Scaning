/** Well layout params on oil_pad / gas_pad infrastructure objects. */

import { isPadSubtype } from '../infraPadEarthwork';

export const PAD_WELL_COUNT = 'pad_well_count';
export const PAD_WELLS_PER_GROUP = 'pad_wells_per_group';
export const PAD_WELL_SPACING_M = 'pad_well_spacing_m';
export const PAD_WELL_GROUP_SPACING_M = 'pad_well_group_spacing_m';
export const PAD_LAYOUT_MARGIN_LEFT_M = 'pad_layout_margin_left_m';
export const PAD_LAYOUT_MARGIN_BOTTOM_M = 'pad_layout_margin_bottom_m';
export const PAD_LAYOUT_MARGIN_TOP_M = 'pad_layout_margin_top_m';
export const PAD_LAYOUT_MARGIN_END_M = 'pad_layout_margin_end_m';

export const DEFAULT_PAD_WELL_COUNT = 12;
export const DEFAULT_PAD_WELLS_PER_GROUP = 1;
export const DEFAULT_PAD_WELL_SPACING_M = 9;
export const DEFAULT_PAD_GROUP_SPACING_M = 9;
export const DEFAULT_PAD_MARGIN_LEFT_M = 27;
export const DEFAULT_PAD_MARGIN_BOTTOM_M = 43;
export const DEFAULT_PAD_MARGIN_TOP_M = 15;
export const DEFAULT_PAD_MARGIN_END_M = 70;

export type PadWellParams = {
  wellCount: number;
  wellsPerGroup: number;
  wellSpacingM: number;
  groupSpacingM: number;
};

export type PadLayoutMargins = {
  leftM: number;
  bottomM: number;
  topM: number;
  endM: number;
};

export type PadWellFormFields = PadWellParams & PadLayoutMargins;

function readPositiveInt(raw: unknown, fallback: number): number {
  if (raw == null || raw === '') return fallback;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.round(n);
}

function readPositiveFloat(raw: unknown, fallback: number): number {
  if (raw == null || raw === '') return fallback;
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

export function pointShowsPadWellFields(subtype: string): boolean {
  return isPadSubtype(subtype);
}

export function readPadWellParams(
  properties: Record<string, unknown> | null | undefined,
): PadWellParams {
  const p = properties ?? {};
  return {
    wellCount: readPositiveInt(p[PAD_WELL_COUNT], DEFAULT_PAD_WELL_COUNT),
    wellsPerGroup: readPositiveInt(p[PAD_WELLS_PER_GROUP], DEFAULT_PAD_WELLS_PER_GROUP),
    wellSpacingM: readPositiveFloat(p[PAD_WELL_SPACING_M], DEFAULT_PAD_WELL_SPACING_M),
    groupSpacingM: readPositiveFloat(p[PAD_WELL_GROUP_SPACING_M], DEFAULT_PAD_GROUP_SPACING_M),
  };
}

export function readPadLayoutMargins(
  properties: Record<string, unknown> | null | undefined,
): PadLayoutMargins {
  const p = properties ?? {};
  return {
    leftM: readPositiveFloat(p[PAD_LAYOUT_MARGIN_LEFT_M], DEFAULT_PAD_MARGIN_LEFT_M),
    bottomM: readPositiveFloat(p[PAD_LAYOUT_MARGIN_BOTTOM_M], DEFAULT_PAD_MARGIN_BOTTOM_M),
    topM: readPositiveFloat(p[PAD_LAYOUT_MARGIN_TOP_M], DEFAULT_PAD_MARGIN_TOP_M),
    endM: readPositiveFloat(p[PAD_LAYOUT_MARGIN_END_M], DEFAULT_PAD_MARGIN_END_M),
  };
}

export function readPadWellFormFields(
  properties: Record<string, unknown> | null | undefined,
): PadWellFormFields {
  return { ...readPadWellParams(properties), ...readPadLayoutMargins(properties) };
}

export function padWellFieldsFromForm(draft: {
  padWellCount: string;
  padWellsPerGroup: string;
  padWellSpacingM: string;
  padGroupSpacingM: string;
  padMarginLeftM: string;
  padMarginBottomM: string;
  padMarginTopM: string;
  padMarginEndM: string;
}): PadWellFormFields {
  return {
    wellCount: readPositiveInt(draft.padWellCount, DEFAULT_PAD_WELL_COUNT),
    wellsPerGroup: readPositiveInt(draft.padWellsPerGroup, DEFAULT_PAD_WELLS_PER_GROUP),
    wellSpacingM: readPositiveFloat(draft.padWellSpacingM, DEFAULT_PAD_WELL_SPACING_M),
    groupSpacingM: readPositiveFloat(draft.padGroupSpacingM, DEFAULT_PAD_GROUP_SPACING_M),
    leftM: readPositiveFloat(draft.padMarginLeftM, DEFAULT_PAD_MARGIN_LEFT_M),
    bottomM: readPositiveFloat(draft.padMarginBottomM, DEFAULT_PAD_MARGIN_BOTTOM_M),
    topM: readPositiveFloat(draft.padMarginTopM, DEFAULT_PAD_MARGIN_TOP_M),
    endM: readPositiveFloat(draft.padMarginEndM, DEFAULT_PAD_MARGIN_END_M),
  };
}

export function padWellFormStringsFromObject(
  properties: Record<string, unknown> | null | undefined,
): Pick<
  InfraPadWellDraftStrings,
  | 'padWellCount'
  | 'padWellsPerGroup'
  | 'padWellSpacingM'
  | 'padGroupSpacingM'
  | 'padMarginLeftM'
  | 'padMarginBottomM'
  | 'padMarginTopM'
  | 'padMarginEndM'
> {
  const f = readPadWellFormFields(properties);
  return {
    padWellCount: String(f.wellCount),
    padWellsPerGroup: String(f.wellsPerGroup),
    padWellSpacingM: String(f.wellSpacingM),
    padGroupSpacingM: String(f.groupSpacingM),
    padMarginLeftM: String(f.leftM),
    padMarginBottomM: String(f.bottomM),
    padMarginTopM: String(f.topM),
    padMarginEndM: String(f.endM),
  };
}

export type InfraPadWellDraftStrings = {
  padWellCount: string;
  padWellsPerGroup: string;
  padWellSpacingM: string;
  padGroupSpacingM: string;
  padMarginLeftM: string;
  padMarginBottomM: string;
  padMarginTopM: string;
  padMarginEndM: string;
};

export function mergePadWellParams(
  properties: Record<string, unknown> | null | undefined,
  fields: PadWellFormFields,
): Record<string, unknown> {
  const next = { ...(properties ?? {}) };
  next[PAD_WELL_COUNT] = fields.wellCount;
  next[PAD_WELLS_PER_GROUP] = fields.wellsPerGroup;
  next[PAD_WELL_SPACING_M] = fields.wellSpacingM;
  next[PAD_WELL_GROUP_SPACING_M] = fields.groupSpacingM;
  next[PAD_LAYOUT_MARGIN_LEFT_M] = fields.leftM;
  next[PAD_LAYOUT_MARGIN_BOTTOM_M] = fields.bottomM;
  next[PAD_LAYOUT_MARGIN_TOP_M] = fields.topM;
  next[PAD_LAYOUT_MARGIN_END_M] = fields.endM;
  return next;
}

export function padWellFieldsDirty(
  properties: Record<string, unknown> | null | undefined,
  draft: InfraPadWellDraftStrings,
): boolean {
  const saved = padWellFormStringsFromObject(properties);
  return (
    draft.padWellCount !== saved.padWellCount
    || draft.padWellsPerGroup !== saved.padWellsPerGroup
    || draft.padWellSpacingM !== saved.padWellSpacingM
    || draft.padGroupSpacingM !== saved.padGroupSpacingM
    || draft.padMarginLeftM !== saved.padMarginLeftM
    || draft.padMarginBottomM !== saved.padMarginBottomM
    || draft.padMarginTopM !== saved.padMarginTopM
    || draft.padMarginEndM !== saved.padMarginEndM
  );
}
