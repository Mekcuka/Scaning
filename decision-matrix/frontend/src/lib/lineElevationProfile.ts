import type { InfraObject } from './api';
import type { LineElevationProfile, LineProfilePoint } from './api/lineElevationProfileApi';

export const LINE_ELEVATION_PROFILE_STEP_M = 'line_elevation_profile_step_m';
export const LINE_ELEVATION_PROFILE_JSON = 'line_elevation_profile_json';
export const LINE_ELEVATION_PROFILE_COMPUTED_AT = 'line_elevation_profile_computed_at';

export const DEFAULT_LINE_PROFILE_STEP_M = 100;
export const MIN_LINE_PROFILE_STEP_M = 10;
export const MAX_LINE_PROFILE_STEP_M = 1000;

export const LINE_PROFILE_EXCLUDE_SUBTYPE = 'well_bottomhole_gs';

export type LineProfileTableRow = LineProfilePoint & {
  picket: string;
  slope_permille: number | null;
};

export function clampLineProfileStepM(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return DEFAULT_LINE_PROFILE_STEP_M;
  return Math.min(MAX_LINE_PROFILE_STEP_M, Math.max(MIN_LINE_PROFILE_STEP_M, n));
}

export function readLineProfileStepM(properties: Record<string, unknown> | null | undefined): number {
  if (!properties) return DEFAULT_LINE_PROFILE_STEP_M;
  return clampLineProfileStepM(properties[LINE_ELEVATION_PROFILE_STEP_M]);
}

/** Совпадает с backend: round(chainage_m, 3). */
export const LINE_PROFILE_CHAINAGE_DECIMALS = 3;

export function roundChainageM(chainageM: number): number {
  const factor = 10 ** LINE_PROFILE_CHAINAGE_DECIMALS;
  return Math.round(chainageM * factor) / factor;
}

/** Расстояние вдоль линии (м) для таблицы и экспорта. */
export function formatChainageM(chainageM: number): string {
  if (!Number.isFinite(chainageM)) return '—';
  return roundChainageM(chainageM).toLocaleString('ru-RU', {
    maximumFractionDigits: LINE_PROFILE_CHAINAGE_DECIMALS,
  });
}

export function formatPicket(chainageM: number): string {
  const rounded = roundChainageM(chainageM);
  const pk = Math.floor(rounded / 100);
  const remainder = rounded - pk * 100;
  const isIntRemainder = Math.abs(remainder - Math.round(remainder)) < 1e-9;

  if (isIntRemainder) {
    return `${pk}+${String(Math.round(remainder)).padStart(3, '0')}`;
  }

  const remStr = remainder.toLocaleString('ru-RU', {
    minimumFractionDigits: 1,
    maximumFractionDigits: LINE_PROFILE_CHAINAGE_DECIMALS,
  });
  return `${pk}+${remStr}`;
}

export function slopePermilleBetween(
  prev: LineProfilePoint | null,
  current: LineProfilePoint,
): number | null {
  if (!prev) return null;
  const dist = current.chainage_m - prev.chainage_m;
  if (dist <= 0) return null;
  const delta = current.elevation_m - prev.elevation_m;
  return Math.round((delta / dist) * 1000 * 10) / 10;
}

export function buildLineProfileTableRows(points: LineProfilePoint[]): LineProfileTableRow[] {
  return points.map((pt, index) => ({
    ...pt,
    picket: formatPicket(pt.chainage_m),
    slope_permille: slopePermilleBetween(index > 0 ? points[index - 1]! : null, pt),
  }));
}

export function parseLineProfileFromObject(obj: InfraObject | null): LineElevationProfile | null {
  if (!obj?.properties) return null;
  const raw = obj.properties[LINE_ELEVATION_PROFILE_JSON];
  if (!raw || typeof raw !== 'object') return null;
  const profile = raw as LineElevationProfile;
  if (!Array.isArray(profile.points) || profile.points.length === 0) return null;
  return profile;
}

/** Длина линии по профилю ЦМР (м), если профиль загружен и валиден. */
export function readLineProfileTotalLengthM(obj: InfraObject | null): number | null {
  const profile = parseLineProfileFromObject(obj);
  if (!profile) return null;
  const len = profile.total_length_m;
  if (!Number.isFinite(len) || len <= 0) return null;
  return len;
}

export function lineProfileTableExportColumns(): import('./exportExcel').ExcelColumn<LineProfileTableRow>[] {
  return [
    { header: 'Пикет', value: (r) => r.picket },
    { header: 'Расстояние, м', value: (r) => formatChainageM(r.chainage_m) },
    { header: 'Отметка, м', value: (r) => r.elevation_m },
    {
      header: 'Уклон, ‰',
      value: (r) => (r.slope_permille == null ? '' : r.slope_permille),
    },
  ];
}

export function lineProfileExportFilename(objectName: string): string {
  const safe = objectName.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
  return `profil_${safe || 'liniya'}.xlsx`;
}

const LINE_PROFILE_DEM_LABELS: Record<string, string> = {
  'synthetic:dev_flat': 'Синтетический ЦМР (dev)',
  'opentopography:COP30': 'OpenTopography COP30',
};

/** Человекочитаемая подпись источника ЦМР для UI профиля линии. */
export function formatLineProfileDemSource(raw: string): string {
  const known = LINE_PROFILE_DEM_LABELS[raw];
  if (known) return known;
  const colon = raw.indexOf(':');
  if (colon > 0) {
    const prefix = raw.slice(0, colon);
    const suffix = raw.slice(colon + 1);
    if (prefix === 'synthetic') return `Синтетический ЦМР (${suffix})`;
    if (prefix === 'opentopography') return `OpenTopography ${suffix}`;
  }
  return raw;
}

export function isSyntheticLineProfileDem(raw: string): boolean {
  return raw.startsWith('synthetic:');
}

export function formatLineProfilePointsCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} точка`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${count} точки`;
  return `${count} точек`;
}

export function lineProfileEligible(subtype: string): boolean {
  return subtype !== LINE_PROFILE_EXCLUDE_SUBTYPE;
}
