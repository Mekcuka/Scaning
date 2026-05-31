import { catalogEntryForSubtype } from './map3dModelCatalog';
import { defaultHeightForSubtype } from './extrusionHeights';

export const RENDER_3D_HEIGHT_KEY = 'render_3d_height_m';
export const RENDER_3D_BASE_KEY = 'render_3d_base_m';
export const RENDER_3D_VISIBLE_KEY = 'render_3d_visible';
export const RENDER_3D_STYLE_KEY = 'render_3d_style';
export const RENDER_3D_MODEL_ID_KEY = 'render_3d_model_id';

export type Render3DConfig = {
  heightM: number;
  baseM: number;
  visible: boolean;
};

function readNumber(props: Record<string, unknown> | undefined, key: string): number | null {
  if (!props) return null;
  const v = props[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Resolve 3D render params: L2 properties override L1 subtype defaults. */
export function resolveRender3D(
  subtype: string,
  properties?: Record<string, unknown> | null,
): Render3DConfig {
  const props = properties ?? undefined;
  const heightOverride = readNumber(props, RENDER_3D_HEIGHT_KEY);
  const baseOverride = readNumber(props, RENDER_3D_BASE_KEY);
  const visibleRaw = props?.[RENDER_3D_VISIBLE_KEY];
  const visible =
    visibleRaw === false || visibleRaw === 'false' ? false : true;

  return {
    heightM: heightOverride ?? defaultHeightForSubtype(subtype),
    baseM: baseOverride ?? 0,
    visible,
  };
}

/** Merge L2 defaults into properties for create/update (only missing keys). */
export function withDefaultRender3DProperties(
  subtype: string,
  properties?: Record<string, unknown> | null,
): Record<string, unknown> {
  const props = { ...(properties ?? {}) };
  if (props[RENDER_3D_HEIGHT_KEY] == null || props[RENDER_3D_HEIGHT_KEY] === '') {
    props[RENDER_3D_HEIGHT_KEY] = defaultHeightForSubtype(subtype);
  }
  if (props[RENDER_3D_BASE_KEY] == null || props[RENDER_3D_BASE_KEY] === '') {
    props[RENDER_3D_BASE_KEY] = 0;
  }
  if (props[RENDER_3D_VISIBLE_KEY] == null) {
    props[RENDER_3D_VISIBLE_KEY] = true;
  }
  return props;
}

/** Point objects with a catalog entry use procedural/glTF models instead of fill-extrusion. */
export function shouldUse3dModel(
  subtype: string,
  properties?: Record<string, unknown> | null,
): boolean {
  const style = properties?.[RENDER_3D_STYLE_KEY];
  if (style === 'extrusion' || style === 'line') return false;
  if (style === 'model') return catalogEntryForSubtype(subtype) != null;
  return catalogEntryForSubtype(subtype) != null;
}
