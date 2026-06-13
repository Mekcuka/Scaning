/** Pad earthwork property keys (mirror backend pad_earthwork/properties.py). */

import type { InfraObject } from './api';
import { POINT_SUBTYPES } from './api/subtypes';

export const PAD_LENGTH_M = 'pad_length_m';
export const PAD_WIDTH_M = 'pad_width_m';
export const PAD_HEIGHT_M = 'pad_height_m';
export const PAD_ROTATION_DEG = 'pad_rotation_deg';
export const DEFAULT_PAD_NDS_DEG = 90;
export const DEFAULT_PAD_LENGTH_M = 120;
export const DEFAULT_PAD_WIDTH_M = 80;
export const DEFAULT_PAD_HEIGHT_M = 1;
export const DEFAULT_PAD_REFERENCE_ELEVATION_M = 0;

/** НДС — азимут ряда скважин, 0…360° (0 = север, по часовой). */
export function clampNdsDeg(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_PAD_NDS_DEG;
  return Math.min(360, Math.max(0, n));
}

/** NDS (clockwise from North) → math CCW angle from East for ENU rotation. */
export function ndsDegToMathRotationDeg(ndsDeg: number): number {
  return 90 - ndsDeg;
}

export function parseNdsDeg(raw: string): number {
  const t = raw.trim().replace(',', '.');
  if (!t) return DEFAULT_PAD_NDS_DEG;
  return clampNdsDeg(Number(t));
}

/** Читает НДС из properties: 90° если ключ отсутствует. */
export function readNdsDegFromProperties(
  props: Record<string, unknown> | null | undefined,
): string {
  const raw = props?.[PAD_ROTATION_DEG];
  if (raw == null || raw === '') return String(DEFAULT_PAD_NDS_DEG);
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(n)) return String(DEFAULT_PAD_NDS_DEG);
  return String(clampNdsDeg(n));
}

/**
 * НДС для панели генератора.
 * Раньше при сохранении полигона в pad_rotation_deg писали 0 — для таких схем с скважинами подставляем 90°.
 */
export function resolveGeneratorNdsDeg(raw: string, hasGeneratedWells = false): string {
  const t = raw.trim();
  if (!t) return String(DEFAULT_PAD_NDS_DEG);
  const n = Number(t.replace(',', '.'));
  if (!Number.isFinite(n)) return String(DEFAULT_PAD_NDS_DEG);
  if (n === 0 && hasGeneratedWells) return String(DEFAULT_PAD_NDS_DEG);
  return String(clampNdsDeg(n));
}
export const PAD_REFERENCE_ELEVATION_M = 'pad_reference_elevation_m';
export const PAD_DEM_ASSET_ID = 'pad_dem_asset_id';
export const PAD_DEM_FETCHED_AT = 'pad_dem_fetched_at';
export const PAD_DEM_SOURCE = 'pad_dem_source';
export const PAD_FILL_VOLUME_M3 = 'pad_fill_volume_m3';
export const PAD_CUT_VOLUME_M3 = 'pad_cut_volume_m3';
export const PAD_EARTHWORK_COMPUTED_AT = 'pad_earthwork_computed_at';
export const PAD_EARTHWORK_SKETCH_SAVED_AT = 'pad_earthwork_sketch_saved_at';
export const PAD_EARTHWORK_SKETCH_JSON = 'pad_earthwork_sketch_json';
export const PAD_ENVELOPE_ENABLED = 'pad_envelope_enabled';
export const PAD_ENVELOPE_WRAP_WIDTH_M = 'pad_envelope_wrap_width_m';

export const DEFAULT_PAD_ENVELOPE_WRAP_WIDTH_M = 3;

const PAD_SUBTYPES = new Set(['oil_pad', 'gas_pad']);
const EARTHWORK_EXCLUDED = new Set(['node']);

export function isPadSubtype(subtype: string): boolean {
  return PAD_SUBTYPES.has(subtype);
}

/** Point map subtypes with pad earthwork (sketch, DEM, volumes) — excludes node only. */
export function isEarthworkEligibleSubtype(subtype: string): boolean {
  return (POINT_SUBTYPES as readonly string[]).includes(subtype) && !EARTHWORK_EXCLUDED.has(subtype);
}

export function readPadParam(props: Record<string, unknown> | null | undefined, key: string): string {
  const raw = props?.[key];
  if (raw == null || raw === '') return '';
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? String(n) : '';
}

/** Длина площадки, м — 120 если ключ отсутствует. */
export function readPadLengthFromProperties(
  props: Record<string, unknown> | null | undefined,
): string {
  const raw = readPadParam(props, PAD_LENGTH_M);
  return raw || String(DEFAULT_PAD_LENGTH_M);
}

/** Ширина площадки, м — 80 если ключ отсутствует. */
export function readPadWidthFromProperties(
  props: Record<string, unknown> | null | undefined,
): string {
  const raw = readPadParam(props, PAD_WIDTH_M);
  return raw || String(DEFAULT_PAD_WIDTH_M);
}

/** Высота насыпи, м — 1 если ключ отсутствует. */
export function readPadHeightFromProperties(
  props: Record<string, unknown> | null | undefined,
): string {
  const raw = readPadParam(props, PAD_HEIGHT_M);
  return raw || String(DEFAULT_PAD_HEIGHT_M);
}

/** Опорная отметка, м — 0 если ключ отсутствует. */
export function readPadReferenceElevationFromProperties(
  props: Record<string, unknown> | null | undefined,
): string {
  const raw = readPadParam(props, PAD_REFERENCE_ELEVATION_M);
  if (raw !== '') return raw;
  return String(DEFAULT_PAD_REFERENCE_ELEVATION_M);
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
    lengthM: readPadLengthFromProperties(p),
    widthM: readPadWidthFromProperties(p),
    heightM: readPadHeightFromProperties(p),
    rotationDeg: readNdsDegFromProperties(p),
    referenceElevationM: readPadReferenceElevationFromProperties(p),
  };
}

export type PadEarthworkParamField =
  | 'length_m'
  | 'width_m'
  | 'height_m'
  | 'reference_elevation_m'
  | 'rotation_deg';

const PAD_PARAM_FIELD_TO_KEY: Record<PadEarthworkParamField, string> = {
  length_m: PAD_LENGTH_M,
  width_m: PAD_WIDTH_M,
  height_m: PAD_HEIGHT_M,
  reference_elevation_m: PAD_REFERENCE_ELEVATION_M,
  rotation_deg: PAD_ROTATION_DEG,
};

/** Parse commit value for parameters table; null clears the property key. */
export function parsePadParamCommit(
  field: PadEarthworkParamField,
  raw: number | '',
): number | null | undefined {
  if (raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return undefined;
  if (field === 'length_m' || field === 'width_m' || field === 'height_m') {
    return n > 0 ? n : undefined;
  }
  if (field === 'rotation_deg') return clampNdsDeg(n);
  return n;
}

export function mergePadEarthworkParam(
  properties: Record<string, unknown> | null | undefined,
  field: PadEarthworkParamField,
  value: number | null,
): Record<string, unknown> {
  const out = { ...(properties ?? {}) };
  const key = PAD_PARAM_FIELD_TO_KEY[field];
  if (value == null) {
    delete out[key];
  } else {
    out[key] = value;
  }
  return out;
}

/** Build PATCH body for pad-earthwork/params from a single field update. */
export function padEarthworkPatchBody(
  field: PadEarthworkParamField,
  value: number,
): Partial<Record<PadEarthworkParamField, number>> {
  return { [field]: value };
}

export function padParamDisplayValue(
  obj: Pick<InfraObject, 'properties'>,
  field: PadEarthworkParamField,
): number | '' {
  const p = padParamsFromObject(obj);
  const map: Record<PadEarthworkParamField, string> = {
    length_m: p.lengthM,
    width_m: p.widthM,
    height_m: p.heightM,
    reference_elevation_m: p.referenceElevationM,
    rotation_deg: p.rotationDeg,
  };
  const raw = map[field];
  if (!raw) {
    if (field === 'length_m') return DEFAULT_PAD_LENGTH_M;
    if (field === 'width_m') return DEFAULT_PAD_WIDTH_M;
    if (field === 'height_m') return DEFAULT_PAD_HEIGHT_M;
    if (field === 'reference_elevation_m') return DEFAULT_PAD_REFERENCE_ELEVATION_M;
    return '';
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : '';
}

/** Defaults for earthwork-eligible point objects on create/update from map. */
export function withDefaultPadEarthworkDimensions(
  subtype: string,
  properties?: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...(properties ?? {}) };
  if (!isEarthworkEligibleSubtype(subtype)) return out;
  if (out[PAD_LENGTH_M] == null || out[PAD_LENGTH_M] === '') {
    out[PAD_LENGTH_M] = DEFAULT_PAD_LENGTH_M;
  }
  if (out[PAD_WIDTH_M] == null || out[PAD_WIDTH_M] === '') {
    out[PAD_WIDTH_M] = DEFAULT_PAD_WIDTH_M;
  }
  if (out[PAD_HEIGHT_M] == null || out[PAD_HEIGHT_M] === '') {
    out[PAD_HEIGHT_M] = DEFAULT_PAD_HEIGHT_M;
  }
  if (out[PAD_REFERENCE_ELEVATION_M] == null || out[PAD_REFERENCE_ELEVATION_M] === '') {
    out[PAD_REFERENCE_ELEVATION_M] = DEFAULT_PAD_REFERENCE_ELEVATION_M;
  }
  return out;
}

/** API требует wrap_width_m > 0 даже при enabled=false (хранится как черновик ширины). */
export function normalizeEnvelopeWrapWidthM(raw: number): number {
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_PAD_ENVELOPE_WRAP_WIDTH_M;
}

export function envelopeWrapForApi(
  enabled: boolean,
  wrapWidthM: number,
): { enabled: boolean; wrap_width_m: number } {
  return { enabled, wrap_width_m: normalizeEnvelopeWrapWidthM(wrapWidthM) };
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
    wrapRaw != null && Number.isFinite(Number(wrapRaw))
      ? Number(wrapRaw)
      : DEFAULT_PAD_ENVELOPE_WRAP_WIDTH_M;
  return { enabled, wrap_width_m: normalizeEnvelopeWrapWidthM(wrap) };
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

export type PadDemStatus = {
  asset_id: string | null;
  source: string | null;
  fetched_at: string | null;
};

export function readDemStatusFromProperties(
  props: Record<string, unknown> | null | undefined,
): PadDemStatus | null {
  const p = props ?? {};
  const assetId = p[PAD_DEM_ASSET_ID];
  if (typeof assetId !== 'string' || !assetId.trim()) return null;
  const source = p[PAD_DEM_SOURCE];
  const fetched = p[PAD_DEM_FETCHED_AT];
  return {
    asset_id: assetId.trim(),
    source: typeof source === 'string' ? source : null,
    fetched_at: typeof fetched === 'string' ? fetched : null,
  };
}
