import { isCustomGltfAssetId } from './map3dCustomAssets';
import { catalogEntryForModelId, catalogEntryForSubtype } from './map3dModelCatalog';
import { defaultHeightForSubtype } from './extrusionHeights';

export const RENDER_3D_HEIGHT_KEY = 'render_3d_height_m';
export const RENDER_3D_BASE_KEY = 'render_3d_base_m';
export const RENDER_3D_VISIBLE_KEY = 'render_3d_visible';
export const RENDER_3D_STYLE_KEY = 'render_3d_style';
export const RENDER_3D_MODEL_ID_KEY = 'render_3d_model_id';
/** Uniform size multiplier for 3D model / extrusion / line tube (1 = default). */
export const RENDER_3D_SCALE_KEY = 'render_3d_scale';

export const DEFAULT_RENDER_3D_SCALE = 1;
export const MIN_RENDER_3D_SCALE = 0.1;
export const MAX_RENDER_3D_SCALE = 10;

export type Render3DConfig = {
  heightM: number;
  baseM: number;
  visible: boolean;
  scale: number;
};

/** Scene height (m) after L2 height × scale — same basis as fill-extrusion. */
export function effectiveRender3dHeightM(render: Render3DConfig): number {
  return render.heightM * render.scale;
}

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

function readPositiveScale(props: Record<string, unknown> | undefined): number {
  const raw = readNumber(props, RENDER_3D_SCALE_KEY);
  if (raw == null || raw <= 0) return DEFAULT_RENDER_3D_SCALE;
  return Math.min(MAX_RENDER_3D_SCALE, Math.max(MIN_RENDER_3D_SCALE, raw));
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
    scale: readPositiveScale(props),
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

  const modelId = properties?.[RENDER_3D_MODEL_ID_KEY];
  if (typeof modelId === 'string' && modelId.trim()) {
    if (catalogEntryForModelId(modelId)) return true;
    if (isCustomGltfAssetId(modelId)) return true;
  }

  return catalogEntryForSubtype(subtype) != null;
}

/**
 * fill-extrusion for a point (mutually exclusive with Three.js model when showModels is on).
 */
export function shouldBuildPointExtrusion(
  subtype: string,
  properties: Record<string, unknown> | null | undefined,
  showModels: boolean,
): boolean {
  const style = properties?.[RENDER_3D_STYLE_KEY];
  if (style === 'extrusion') return true;
  if (!shouldUse3dModel(subtype, properties)) return true;
  return !showModels;
}
