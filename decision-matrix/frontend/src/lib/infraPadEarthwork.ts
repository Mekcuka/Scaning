/** Pad earthwork property keys (mirror backend pad_earthwork/properties.py). */

import type { InfraObject } from './api';

export const PAD_LENGTH_M = 'pad_length_m';
export const PAD_WIDTH_M = 'pad_width_m';
export const PAD_HEIGHT_M = 'pad_height_m';
export const PAD_ROTATION_DEG = 'pad_rotation_deg';
export const PAD_REFERENCE_ELEVATION_M = 'pad_reference_elevation_m';
export const PAD_FILL_VOLUME_M3 = 'pad_fill_volume_m3';
export const PAD_CUT_VOLUME_M3 = 'pad_cut_volume_m3';
export const PAD_EARTHWORK_COMPUTED_AT = 'pad_earthwork_computed_at';
export const PAD_EARTHWORK_SKETCH_SAVED_AT = 'pad_earthwork_sketch_saved_at';
export const PAD_EARTHWORK_SKETCH_JSON = 'pad_earthwork_sketch_json';
export const PAD_ENVELOPE_ENABLED = 'pad_envelope_enabled';
export const PAD_ENVELOPE_WRAP_WIDTH_M = 'pad_envelope_wrap_width_m';

const PAD_SUBTYPES = new Set(['oil_pad', 'gas_pad']);

export function isPadSubtype(subtype: string): boolean {
  return PAD_SUBTYPES.has(subtype);
}

export function readPadParam(props: Record<string, unknown> | null | undefined, key: string): string {
  const raw = props?.[key];
  if (raw == null || raw === '') return '';
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? String(n) : '';
}

export function padParamsFromObject(obj: Pick<InfraObject, 'properties'>): {
  lengthM: string;
  widthM: string;
  heightM: string;
  rotationDeg: string;
  referenceElevationM: string;
} {
  const p = obj.properties ?? {};
  return {
    lengthM: readPadParam(p, PAD_LENGTH_M),
    widthM: readPadParam(p, PAD_WIDTH_M),
    heightM: readPadParam(p, PAD_HEIGHT_M),
    rotationDeg: readPadParam(p, PAD_ROTATION_DEG) || '0',
    referenceElevationM: readPadParam(p, PAD_REFERENCE_ELEVATION_M),
  };
}

export function envelopeFromObject(
  props: Record<string, unknown> | null | undefined,
): { enabled: boolean; wrap_width_m: number } | null {
  const p = props ?? {};
  const enabledRaw = p[PAD_ENVELOPE_ENABLED];
  if (enabledRaw == null) return null;
  const enabled = Boolean(enabledRaw);
  const wrapRaw = p[PAD_ENVELOPE_WRAP_WIDTH_M];
  const wrap =
    wrapRaw != null && Number.isFinite(Number(wrapRaw)) ? Number(wrapRaw) : 3;
  return { enabled, wrap_width_m: wrap };
}

export function sketchSavedAtFromObject(
  props: Record<string, unknown> | null | undefined,
): string | null {
  const raw = props?.[PAD_EARTHWORK_SKETCH_SAVED_AT];
  return typeof raw === 'string' && raw ? raw : null;
}

export function hasSavedPadSketch(props: Record<string, unknown> | null | undefined): boolean {
  const raw = props?.[PAD_EARTHWORK_SKETCH_JSON];
  return raw != null && typeof raw === 'object';
}
