import { defaultHeightForSubtype } from './extrusionHeights';
import { scaleMap3dMeters } from './map3dConfig';
import { type Render3DConfig } from './render3d';

/** Default 3D tube radius (m) per line subtype. */
export const LINE_TUBE_RADIUS_DEFAULT_M: Record<string, number> = {
  autoroad: 4,
  oil_pipeline: 2.5,
  gas_pipeline: 2.5,
  water_pipeline: 2,
  power_line: 1.5,
  methanol_pipeline: 2,
  additional_line: 2,
};

const FALLBACK_RADIUS_M = 2.5;

/** Catalog outer diameter (m) for a line subtype, or null if unknown. */
export function defaultLineDiameterM(subtype: string): number | null {
  const radius = LINE_TUBE_RADIUS_DEFAULT_M[subtype];
  return radius != null ? radius * 2 : null;
}

/**
 * Legacy: before `render_3d_diameter_m`, a non-L1 `render_3d_height_m` was treated as diameter.
 */
export function legacyLineDiameterFromHeight(subtype: string, render: Render3DConfig): number | null {
  const l1 = defaultHeightForSubtype(subtype);
  if (Math.abs(render.heightM - l1) <= 1e-6) return null;
  return render.heightM > 0 ? render.heightM : null;
}

/** Resolved outer diameter in meters (before scene scale). */
export function resolvedLineDiameterM(subtype: string, render: Render3DConfig): number {
  if (render.diameterM != null && render.diameterM > 0) {
    return render.diameterM;
  }
  const legacy = legacyLineDiameterFromHeight(subtype, render);
  if (legacy != null) return legacy;
  const catalog = defaultLineDiameterM(subtype);
  if (catalog != null) return catalog;
  return Math.max(0.2, render.heightM > 0 ? render.heightM : FALLBACK_RADIUS_M * 2);
}

/** Effective outer diameter (m) after scale — same basis as tube radius. */
export function effectiveLineDiameterM(subtype: string, render: Render3DConfig): number {
  return resolvedLineDiameterM(subtype, render) * render.scale;
}

/** Tube radius in scene meters. */
export function resolveLineTubeRadiusM(subtype: string, render: Render3DConfig): number {
  const radius = Math.max(0.1, effectiveLineDiameterM(subtype, render) / 2);
  return scaleMap3dMeters(radius);
}

export function lineDiameterFieldHint(subtype: string, render: Render3DConfig): string {
  const catalog = defaultLineDiameterM(subtype);
  const d = effectiveLineDiameterM(subtype, render);
  if (catalog != null && Math.abs(d - catalog * render.scale) < 1e-6) {
    return `По умолчанию ${catalog} м; масштаб умножает диаметр`;
  }
  return `Наружный диаметр ${d.toFixed(1)} м в 3D (с учётом масштаба)`;
}
