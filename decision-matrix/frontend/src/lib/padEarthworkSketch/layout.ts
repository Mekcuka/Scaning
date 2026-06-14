import {
  clampNdsDeg,
  DEFAULT_PAD_NDS_DEG,
  ndsDegToMathRotationDeg,
} from '../infraPadEarthwork';
import { padWellFieldsFromForm, type InfraPadWellDraftStrings } from '../infraPadWells';
import { MAX_LENGTH, MAX_WIDTH } from './clamp';
import { polygonFootprintAreaM2 } from './polygon';
import type { PlanPolygonSketch, PlanVertex } from './types';

export type PadLayoutMarginsInput = {
  leftM: number;
  bottomM: number;
  topM: number;
  endM: number;
};

export type PadWellLayoutInput = {
  wellCount: number;
  wellsPerGroup: number;
  wellSpacingM: number;
  groupSpacingM: number;
  margins: PadLayoutMarginsInput;
  rotationDeg?: number;
};

export type PadWellLayoutResult = {
  sketch: PlanPolygonSketch;
  wellsLocal: PlanVertex[];
  lengthM: number;
  widthM: number;
  rotationDeg: number;
  footprintAreaM2: number;
};

export class PadWellLayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PadWellLayoutError';
  }
}

export function computeWellPositionsEastM(
  wellCount: number,
  wellsPerGroup: number,
  wellSpacingM: number,
  groupSpacingM: number,
): number[] {
  if (wellCount < 1) throw new PadWellLayoutError('well_count must be at least 1');
  const positions = [0];
  for (let i = 1; i < wellCount; i += 1) {
    if (i % wellsPerGroup !== 0) {
      positions.push(positions[i - 1]! + wellSpacingM);
    } else {
      positions.push(positions[i - 1]! + groupSpacingM);
    }
  }
  return positions;
}

function rotatePlanPoint(eastM: number, northM: number, rotationDeg: number): PlanVertex {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    east_m: eastM * cos - northM * sin,
    north_m: eastM * sin + northM * cos,
  };
}

/** Inverse of NDS layout rotation — row-local frame (along-row = east, cross-row = north). */
export function enuToRowLocal(eastM: number, northM: number, ndsDeg: number): PlanVertex {
  const mathDeg = ndsDegToMathRotationDeg(ndsDeg);
  const rad = (-mathDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    east_m: eastM * cos - northM * sin,
    north_m: eastM * sin + northM * cos,
  };
}

export function validateGeneratedWellLayout(
  result: PadWellLayoutResult,
  input: PadWellLayoutInput,
  tolM = 0.05,
): boolean {
  const ndsDeg = input.rotationDeg ?? DEFAULT_PAD_NDS_DEG;
  const { leftM, bottomM, topM, endM } = input.margins;
  const positions = computeWellPositionsEastM(
    input.wellCount,
    input.wellsPerGroup,
    input.wellSpacingM,
    input.groupSpacingM,
  );
  const lastEast = positions[positions.length - 1]!;

  for (const well of result.wellsLocal) {
    const local = enuToRowLocal(well.east_m, well.north_m, ndsDeg);
    if (Math.abs(local.north_m) > tolM) return false;
  }

  const locals = result.sketch.vertices.map((v) => enuToRowLocal(v.east_m, v.north_m, ndsDeg));
  let minE = Infinity;
  let maxE = -Infinity;
  let minN = Infinity;
  let maxN = -Infinity;
  for (const v of locals) {
    minE = Math.min(minE, v.east_m);
    maxE = Math.max(maxE, v.east_m);
    minN = Math.min(minN, v.north_m);
    maxN = Math.max(maxN, v.north_m);
  }

  return (
    Math.abs(minE + leftM) <= tolM &&
    Math.abs(maxE - (lastEast + endM)) <= tolM &&
    Math.abs(minN + bottomM) <= tolM &&
    Math.abs(maxN - topM) <= tolM
  );
}

function parseLayoutRotationNds(raw: string): number {
  const t = raw.trim().replace(',', '.');
  if (!t) return DEFAULT_PAD_NDS_DEG;
  const n = Number(t);
  return Number.isFinite(n) ? clampNdsDeg(n) : DEFAULT_PAD_NDS_DEG;
}

/** Live layout preview from pad clustering / generator form fields (null when invalid). */
export function tryLayoutPreviewFromWellForm(
  draft: InfraPadWellDraftStrings & { rotationDeg: string },
): PadWellLayoutResult | null {
  try {
    const fields = padWellFieldsFromForm(draft);
    if (
      fields.wellCount < 1 ||
      fields.wellsPerGroup < 1 ||
      fields.wellSpacingM <= 0 ||
      fields.wellSpacingM > 500 ||
      fields.groupSpacingM < 0 ||
      fields.leftM < 0 ||
      fields.bottomM < 0 ||
      fields.topM < 0 ||
      fields.endM < 0
    ) {
      return null;
    }
    return generatePadFromWells({
      wellCount: fields.wellCount,
      wellsPerGroup: fields.wellsPerGroup,
      wellSpacingM: fields.wellSpacingM,
      groupSpacingM: fields.groupSpacingM,
      margins: {
        leftM: fields.leftM,
        bottomM: fields.bottomM,
        topM: fields.topM,
        endM: fields.endM,
      },
      rotationDeg: parseLayoutRotationNds(draft.rotationDeg),
    });
  } catch (err) {
    if (err instanceof PadWellLayoutError) return null;
    throw err;
  }
}

export function generatePadFromWells(input: PadWellLayoutInput): PadWellLayoutResult {
  const ndsDeg = input.rotationDeg ?? DEFAULT_PAD_NDS_DEG;
  const rotationDeg = ndsDegToMathRotationDeg(ndsDeg);
  const positions = computeWellPositionsEastM(
    input.wellCount,
    input.wellsPerGroup,
    input.wellSpacingM,
    input.groupSpacingM,
  );
  const lastEast = positions[positions.length - 1]!;
  const { leftM, bottomM, topM, endM } = input.margins;
  const lengthM = leftM + lastEast + endM;
  const widthM = bottomM + topM;
  if (lengthM <= 0 || widthM <= 0 || lengthM > MAX_LENGTH || widthM > MAX_WIDTH) {
    throw new PadWellLayoutError('pad dimensions exceed limits');
  }

  const rawCorners: PlanVertex[] = [
    { east_m: -leftM, north_m: -bottomM },
    { east_m: lastEast + endM, north_m: -bottomM },
    { east_m: lastEast + endM, north_m: topM },
    { east_m: -leftM, north_m: topM },
  ];
  const vertices = rawCorners.map((v) => rotatePlanPoint(v.east_m, v.north_m, rotationDeg));
  const wellsLocal = positions.map((east) => rotatePlanPoint(east, 0, rotationDeg));
  const sketch: PlanPolygonSketch = { kind: 'plan_polygon', vertices };
  return {
    sketch,
    wellsLocal,
    lengthM,
    widthM,
    rotationDeg: ndsDeg,
    footprintAreaM2: polygonFootprintAreaM2(sketch),
  };
}
