import type { WellTrajectoryLastResponse } from './api/wellTrajectoryApi';
import type { EnvelopeWrap } from './api/padEarthworkApi';
import {
  PAD_ENVELOPE_ENABLED,
  PAD_ENVELOPE_WRAP_WIDTH_M,
  normalizeEnvelopeWrapWidthM,
} from './infraPadEarthwork';

export const WELL_TRAJECTORY_STEP_M = 'well_trajectory_step_m';
export const WELL_TRAJECTORY_AZI_REFERENCE = 'well_trajectory_azi_reference';
export const WELL_TRAJECTORY_ERROR_MODEL = 'well_trajectory_error_model';
export const WELL_TRAJECTORY_STUB_TVD_M = 'well_trajectory_stub_tvd_m';
export const WELL_TRAJECTORY_DEFAULT_TVD_M = 'well_trajectory_default_tvd_m';
export const WELL_TRAJECTORY_SF_WARNING_THRESHOLD = 'well_trajectory_sf_warning_threshold';
export const WELL_TRAJECTORY_INC_HEEL = 'well_trajectory_inc_heel';
export const WELL_TRAJECTORY_GS_ENTRY_SEARCH_STEP_M = 'well_trajectory_gs_entry_search_step_m';

export const DEFAULT_CALC_STEP_M = 30;
export const DEFAULT_STUB_TVD_M = 100;
export const DEFAULT_DEFAULT_TVD_M = 1500;
export const DEFAULT_SF_THRESHOLD = 1;
export const DEFAULT_INC_HEEL = 90;
export const DEFAULT_ERROR_MODEL = 'ISCWSA MWD Rev5.11';

export type AziReference = 'grid' | 'magnetic' | 'true';

export type PadClusteringCalcDraft = {
  stepM: string;
  aziReference: AziReference;
  errorModel: string;
  stubTvdM: string;
  defaultTvdM: string;
  sfWarningThreshold: string;
  incHeel: string;
  gsEntrySearchStepM: string;
  envelopeEnabled: boolean;
  envelopeWrapWidthM: string;
};

export const AZI_REFERENCE_OPTIONS: { value: AziReference; label: string }[] = [
  { value: 'grid', label: 'Grid (сетка)' },
  { value: 'magnetic', label: 'Magnetic' },
  { value: 'true', label: 'True' },
];

export const ERROR_MODEL_OPTIONS = [
  DEFAULT_ERROR_MODEL,
  'ISCWSA MWD Rev4',
  'ISCWSA Rev2',
];

function readNum(raw: unknown, fallback: number): number {
  if (raw == null || raw === '') return fallback;
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

function readAzi(raw: unknown): AziReference {
  const v = String(raw ?? 'grid').toLowerCase();
  if (v === 'magnetic' || v === 'true') return v;
  return 'grid';
}

export function calcDraftFromSources(input: {
  properties?: Record<string, unknown> | null;
  settings?: WellTrajectoryLastResponse['settings'] | null;
  envelope?: EnvelopeWrap | null;
}): PadClusteringCalcDraft {
  const props = input.properties ?? {};
  const settings = input.settings;
  const envelope = input.envelope;

  return {
    stepM: String(readNum(props[WELL_TRAJECTORY_STEP_M] ?? settings?.step_m, DEFAULT_CALC_STEP_M)),
    aziReference: readAzi(props[WELL_TRAJECTORY_AZI_REFERENCE] ?? settings?.default_azi_reference),
    errorModel: String(
      props[WELL_TRAJECTORY_ERROR_MODEL] ?? settings?.default_error_model ?? DEFAULT_ERROR_MODEL,
    ),
    stubTvdM: String(readNum(props[WELL_TRAJECTORY_STUB_TVD_M] ?? settings?.stub_tvd_m, DEFAULT_STUB_TVD_M)),
    defaultTvdM: String(
      readNum(
        props[WELL_TRAJECTORY_DEFAULT_TVD_M] ?? settings?.default_target_tvd_m,
        DEFAULT_DEFAULT_TVD_M,
      ),
    ),
    sfWarningThreshold: String(
      readNum(
        props[WELL_TRAJECTORY_SF_WARNING_THRESHOLD] ?? settings?.sf_warning_threshold,
        DEFAULT_SF_THRESHOLD,
      ),
    ),
    incHeel: String(readNum(props[WELL_TRAJECTORY_INC_HEEL] ?? settings?.inc_heel, DEFAULT_INC_HEEL)),
    gsEntrySearchStepM: String(
      readNum(
        props[WELL_TRAJECTORY_GS_ENTRY_SEARCH_STEP_M] ?? settings?.gs_entry_search_step_m,
        DEFAULT_CALC_STEP_M,
      ),
    ),
    envelopeEnabled: envelope?.enabled ?? false,
    envelopeWrapWidthM: String(envelope?.wrap_width_m ?? 0),
  };
}

function parsePositive(raw: string, fallback: number): number {
  const t = raw.trim().replace(',', '.');
  if (!t) return fallback;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function mergeCalcSettingsIntoProperties(
  existing: Record<string, unknown> | null | undefined,
  draft: PadClusteringCalcDraft,
): Record<string, unknown> {
  const wrap = parsePositive(draft.envelopeWrapWidthM, 0);
  return {
    ...(existing ?? {}),
    [WELL_TRAJECTORY_STEP_M]: parsePositive(draft.stepM, DEFAULT_CALC_STEP_M),
    [WELL_TRAJECTORY_AZI_REFERENCE]: draft.aziReference,
    [WELL_TRAJECTORY_ERROR_MODEL]: draft.errorModel.trim() || DEFAULT_ERROR_MODEL,
    [WELL_TRAJECTORY_STUB_TVD_M]: parsePositive(draft.stubTvdM, DEFAULT_STUB_TVD_M),
    [WELL_TRAJECTORY_DEFAULT_TVD_M]: parsePositive(draft.defaultTvdM, DEFAULT_DEFAULT_TVD_M),
    [WELL_TRAJECTORY_SF_WARNING_THRESHOLD]: parsePositive(draft.sfWarningThreshold, DEFAULT_SF_THRESHOLD),
    [WELL_TRAJECTORY_INC_HEEL]: parsePositive(draft.incHeel, DEFAULT_INC_HEEL),
    [WELL_TRAJECTORY_GS_ENTRY_SEARCH_STEP_M]: parsePositive(
      draft.gsEntrySearchStepM,
      DEFAULT_CALC_STEP_M,
    ),
    [PAD_ENVELOPE_ENABLED]: draft.envelopeEnabled,
    [PAD_ENVELOPE_WRAP_WIDTH_M]: normalizeEnvelopeWrapWidthM(wrap),
  };
}

export function readWellTrajectoryStepM(input: {
  properties?: Record<string, unknown> | null;
  settings?: WellTrajectoryLastResponse['settings'] | null;
}): number {
  const props = input.properties ?? {};
  return readNum(props[WELL_TRAJECTORY_STEP_M] ?? input.settings?.step_m, DEFAULT_CALC_STEP_M);
}

export function calcDraftEquals(a: PadClusteringCalcDraft, b: PadClusteringCalcDraft): boolean {
  return (
    a.stepM === b.stepM &&
    a.aziReference === b.aziReference &&
    a.errorModel === b.errorModel &&
    a.stubTvdM === b.stubTvdM &&
    a.defaultTvdM === b.defaultTvdM &&
    a.sfWarningThreshold === b.sfWarningThreshold &&
    a.incHeel === b.incHeel &&
    a.gsEntrySearchStepM === b.gsEntrySearchStepM &&
    a.envelopeEnabled === b.envelopeEnabled &&
    a.envelopeWrapWidthM === b.envelopeWrapWidthM
  );
}
