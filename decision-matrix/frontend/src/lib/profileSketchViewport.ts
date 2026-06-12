/** Pan/zoom viewport helpers for pad earthwork profile editor (chainage × elevation). */

import type { ProfileSketch } from './padEarthworkSketch';

export type ProfileSketchPan = {
  chainage_m: number;
  elevation_m: number;
};

const PROFILE_VIEW_PAD = 1.25;

export type ProfileViewExtents = {
  centerChainage: number;
  centerElevation: number;
  halfChainage: number;
  halfElevation: number;
  minChainage: number;
  maxChainage: number;
};

export function profileViewExtents(
  sketch: ProfileSketch,
  envelopeActive: boolean,
  wrapWidthM: number,
  referenceElevationM: number,
): ProfileViewExtents {
  const points = sketch.chainage_points;
  const chainages = points.map((p) => p.chainage_m);
  const elevations = points.map((p) => p.elevation_m);
  elevations.push(sketch.design_elevation_m);
  if (envelopeActive) {
    elevations.push(referenceElevationM);
  }
  const minC = chainages.length ? Math.min(...chainages) : 0;
  const maxC = chainages.length ? Math.max(...chainages) : 100;
  const pad = envelopeActive ? Math.max(0, wrapWidthM) : 0;
  const minChainage = minC - pad;
  const maxChainage = maxC + pad;
  const minE = elevations.length ? Math.min(...elevations) : 0;
  const maxE = elevations.length ? Math.max(...elevations) : 10;
  const chainageSpan = Math.max(1, maxChainage - minChainage);
  const elevSpan = Math.max(maxE - minE, 0);
  const minElevHalfSpan = Math.max(2, elevSpan / 2, chainageSpan * 0.06);
  const halfC = Math.max(10, chainageSpan / 2);
  const halfE = Math.max(minElevHalfSpan, elevSpan / 2 || 5);
  return {
    centerChainage: (minChainage + maxChainage) / 2,
    centerElevation: (minE + maxE) / 2,
    halfChainage: halfC * PROFILE_VIEW_PAD,
    halfElevation: halfE * PROFILE_VIEW_PAD,
    minChainage,
    maxChainage,
  };
}

export function profileFitPan(extents: ProfileViewExtents): ProfileSketchPan {
  return {
    chainage_m: extents.centerChainage,
    elevation_m: extents.centerElevation,
  };
}

export const MIN_PROFILE_SKETCH_ZOOM = 0.25;
export const MAX_PROFILE_SKETCH_ZOOM = 8;
export const PROFILE_SKETCH_WHEEL_ZOOM_FACTOR = 1.12;

export function clampProfileSketchZoom(zoom: number): number {
  return Math.min(MAX_PROFILE_SKETCH_ZOOM, Math.max(MIN_PROFILE_SKETCH_ZOOM, zoom));
}

export function balanceProfileViewHalves(
  viewHalfChainage: number,
  viewHalfElevation: number,
  viewportWidth: number,
  viewportHeight: number,
): { viewHalfChainage: number; viewHalfElevation: number } {
  if (viewHalfChainage <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return { viewHalfChainage, viewHalfElevation };
  }
  const minHalfElevation = viewHalfChainage * (viewportHeight / viewportWidth);
  return {
    viewHalfChainage,
    viewHalfElevation: Math.max(viewHalfElevation, minHalfElevation),
  };
}

export function buildProfileViewBox(
  panChainage: number,
  panElevation: number,
  viewHalfChainage: number,
  viewHalfElevation: number,
): string {
  const minX = panChainage - viewHalfChainage;
  const minY = panElevation - viewHalfElevation;
  const width = viewHalfChainage * 2;
  const height = viewHalfElevation * 2;
  return `${minX} ${minY} ${width} ${height}`;
}

export function profileGridLines(
  panChainage: number,
  panElevation: number,
  viewHalfChainage: number,
  viewHalfElevation: number,
  chainageStep: number,
  elevationStep: number,
): { x1: number; y1: number; x2: number; y2: number }[] {
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const minC = panChainage - viewHalfChainage;
  const maxC = panChainage + viewHalfChainage;
  const minE = panElevation - viewHalfElevation;
  const maxE = panElevation + viewHalfElevation;
  if (chainageStep > 0) {
    const startC = Math.floor(minC / chainageStep) * chainageStep;
    for (let c = startC; c <= maxC + chainageStep * 0.001; c += chainageStep) {
      lines.push({ x1: c, y1: minE, x2: c, y2: maxE });
    }
  }
  if (elevationStep > 0) {
    const startE = Math.floor(minE / elevationStep) * elevationStep;
    for (let e = startE; e <= maxE + elevationStep * 0.001; e += elevationStep) {
      lines.push({ x1: minC, y1: e, x2: maxC, y2: e });
    }
  }
  return lines;
}

export function zoomProfileAtWorldPoint(
  zoom: number,
  viewHalfChainage: number,
  viewHalfElevation: number,
  pan: ProfileSketchPan,
  anchorChainage: number,
  anchorElevation: number,
  zoomFactor: number,
): { zoom: number; pan: ProfileSketchPan } {
  const nextZoom = clampProfileSketchZoom(zoom * zoomFactor);
  if (nextZoom === zoom) return { zoom, pan };
  const nextHalfC = viewHalfChainage * (zoom / nextZoom);
  const nextHalfE = viewHalfElevation * (zoom / nextZoom);
  const relC = anchorChainage - pan.chainage_m;
  const relE = anchorElevation - pan.elevation_m;
  const scaleC = nextHalfC / viewHalfChainage;
  const scaleE = nextHalfE / viewHalfElevation;
  return {
    zoom: nextZoom,
    pan: {
      chainage_m: anchorChainage - relC * scaleC,
      elevation_m: anchorElevation - relE * scaleE,
    },
  };
}

export function clientToProfileLocal(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { chainage_m: number; elevation_m: number } | null {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const local = pt.matrixTransform(ctm.inverse());
  return { chainage_m: local.x, elevation_m: local.y };
}
