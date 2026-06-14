import {
  createDefaultPlanSketch,
  planFromFormFields,
  type PlanPolygonSketch,
  type PlanShapeSketch,
  type PlanVertex,
} from '../../lib/padEarthworkSketch';
import {
  DEFAULT_PAD_GROUP_SPACING_M,
  DEFAULT_PAD_MARGIN_BOTTOM_M,
  DEFAULT_PAD_MARGIN_END_M,
  DEFAULT_PAD_MARGIN_LEFT_M,
  DEFAULT_PAD_MARGIN_TOP_M,
  DEFAULT_PAD_WELL_COUNT,
  DEFAULT_PAD_WELLS_PER_GROUP,
  DEFAULT_PAD_WELL_SPACING_M,
} from '../../lib/infraPadWells';
import type { PadEarthworkComputeResult, PadDemStatus } from '../../lib/api/padEarthworkApi';

export interface PadEarthworkSketchModalProps {
  projectId: string;
  objectId: string;
  readOnly: boolean;
  lengthM: string;
  widthM: string;
  heightM: string;
  rotationDeg: string;
  referenceElevationM: string;
  initialSketch?: PlanShapeSketch | null;
  initialWellsLocal?: PlanVertex[];
  initialEnvelope?: { enabled: boolean; wrap_width_m: number } | null;
  padWellCount?: string;
  setPadWellCount?: (value: string) => void;
  padWellsPerGroup?: string;
  setPadWellsPerGroup?: (value: string) => void;
  padWellSpacingM?: string;
  setPadWellSpacingM?: (value: string) => void;
  padGroupSpacingM?: string;
  setPadGroupSpacingM?: (value: string) => void;
  padMarginLeftM?: string;
  setPadMarginLeftM?: (value: string) => void;
  padMarginBottomM?: string;
  setPadMarginBottomM?: (value: string) => void;
  padMarginTopM?: string;
  setPadMarginTopM?: (value: string) => void;
  padMarginEndM?: string;
  setPadMarginEndM?: (value: string) => void;
  setRotationDeg?: (value: string) => void;
  onClose: () => void;
  onApplyToFields: (fields: {
    lengthM: string;
    widthM: string;
    rotationDeg: string;
    heightM: string;
    referenceElevationM: string;
  }) => void;
  onComputeSuccess: (result: PadEarthworkComputeResult) => void;
  onSaveSuccess?: () => void;
  onApplySandDemand: (fillM3: number) => void;
  demStatus?: PadDemStatus | null;
  terrainMode?: 'flat' | 'dem';
  /** Well-layout generator — only oil_pad / gas_pad. */
  showGenerator?: boolean;
}

export type PadEarthworkSketchTabId = 'plan' | 'scene3d';

export type GeneratorFields = {
  padWellCount: string;
  padWellsPerGroup: string;
  padWellSpacingM: string;
  padGroupSpacingM: string;
  padMarginLeftM: string;
  padMarginBottomM: string;
  padMarginTopM: string;
  padMarginEndM: string;
  rotationDeg: string;
};

export type GeneratorSnapshot = {
  sketch: PlanPolygonSketch;
  wellsLocal: PlanVertex[];
};

export const DEFAULT_GENERATOR_FIELDS: GeneratorFields = {
  padWellCount: String(DEFAULT_PAD_WELL_COUNT),
  padWellsPerGroup: String(DEFAULT_PAD_WELLS_PER_GROUP),
  padWellSpacingM: String(DEFAULT_PAD_WELL_SPACING_M),
  padGroupSpacingM: String(DEFAULT_PAD_GROUP_SPACING_M),
  padMarginLeftM: String(DEFAULT_PAD_MARGIN_LEFT_M),
  padMarginBottomM: String(DEFAULT_PAD_MARGIN_BOTTOM_M),
  padMarginTopM: String(DEFAULT_PAD_MARGIN_TOP_M),
  padMarginEndM: String(DEFAULT_PAD_MARGIN_END_M),
  rotationDeg: '0',
};

export function parseHeightRef(heightM: string, referenceElevationM: string) {
  const h = heightM.trim().replace(',', '.');
  const ref = referenceElevationM.trim().replace(',', '.');
  const height = h ? Number(h) : NaN;
  const reference = ref === '' ? 0 : Number(ref);
  if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(reference)) return null;
  return { height_m: height, reference_elevation_m: reference };
}

export function initialSketchState(
  initialSketch: PlanShapeSketch | null | undefined,
  lengthM: string,
  widthM: string,
  rotationDeg: string,
): PlanShapeSketch {
  if (initialSketch) return initialSketch;
  return planFromFormFields(lengthM, widthM, rotationDeg) ?? createDefaultPlanSketch();
}

export function cloneGeneratorSnapshot(
  sketch: PlanPolygonSketch,
  wellsLocal: PlanVertex[],
): GeneratorSnapshot {
  return {
    sketch: {
      kind: 'plan_polygon',
      vertices: sketch.vertices.map((v) => ({ east_m: v.east_m, north_m: v.north_m })),
    },
    wellsLocal: wellsLocal.map((w) => ({ east_m: w.east_m, north_m: w.north_m })),
  };
}
