/** Pad earthwork plan sketch types and constants. */

import {
  DEFAULT_PAD_LENGTH_M,
  DEFAULT_PAD_WIDTH_M,
} from '../infraPadEarthwork';

export type PlanVertex = {
  east_m: number;
  north_m: number;
};

export type PlanRectangleSketch = {
  kind: 'plan_rectangle';
  length_m: number;
  width_m: number;
  rotation_deg: number;
};

export type PlanPolygonSketch = {
  kind: 'plan_polygon';
  vertices: PlanVertex[];
};

export type PlanShapeSketch = PlanRectangleSketch | PlanPolygonSketch;

export type ShapeMode = 'rectangle' | 'polygon' | 'generator';

export type PadEarthworkSketch = PlanShapeSketch;

export type SketchPreview = {
  length_m: number;
  width_m: number;
  rotation_deg: number;
  footprint_area_m2: number;
  footprint_corners_local: { east_m: number; north_m: number }[];
};

export const DEFAULT_PLAN_LENGTH_M = DEFAULT_PAD_LENGTH_M;
export const DEFAULT_PLAN_WIDTH_M = DEFAULT_PAD_WIDTH_M;
export const SNAP_STEP_M = 1;

export const PAD_SIZE_PRESETS: { label: string; length_m: number; width_m: number }[] = [
  { label: '80×60', length_m: 80, width_m: 60 },
  { label: '120×80', length_m: 120, width_m: 80 },
  { label: '150×100', length_m: 150, width_m: 100 },
  { label: '200×120', length_m: 200, width_m: 120 },
];

export type PlanEditTool = 'corners' | 'edges' | 'rotate';
export type PolygonEditTool = 'draw' | 'vertices' | 'insert' | 'erase';

export const MAX_POLYGON_VERTICES = 64;
export const MIN_POLYGON_VERTICES = 3;

export function snapMeters(value: number, step: number): number {
  if (step <= 0 || !Number.isFinite(value)) return value;
  return Math.round(value / step) * step;
}

export function isPlanPolygon(sketch: PlanShapeSketch): sketch is PlanPolygonSketch {
  return sketch.kind === 'plan_polygon';
}

export function isPlanRectangle(sketch: PlanShapeSketch): sketch is PlanRectangleSketch {
  return sketch.kind === 'plan_rectangle';
}

/** Initial shape tab when opening sketch modal (generator only for oil/gas pads). */
export function resolveInitialShapeMode(
  showGenerator: boolean,
  initialSketch: PlanShapeSketch | null | undefined,
): ShapeMode {
  if (showGenerator) return 'generator';
  if (initialSketch && isPlanPolygon(initialSketch)) return 'polygon';
  if (initialSketch && isPlanRectangle(initialSketch)) return 'rectangle';
  return 'rectangle';
}

export function shapeModeFromSketch(
  sketch: PlanShapeSketch | null | undefined,
  wellsLocal?: PlanVertex[],
): ShapeMode {
  if (wellsLocal?.length) return 'generator';
  if (sketch && isPlanPolygon(sketch)) return 'polygon';
  return 'rectangle';
}
