/**
 * Параметры 3D-отрисовки на объект (L2) в `properties` инфраструктуры.
 *
 * L1 = значения по умолчанию для subtype (высоты в extrusionHeights.ts, каталог моделей в map3dModelCatalog).
 * L2 = эти ключи на каждом объекте; при задании переопределяют L1.
 *
 * Разрешение высоты: render_3d_height_m (L2) ?? defaultHeightForSubtype (L1) → × render_3d_scale
 * через effectiveRender3dHeightM — одно значение для fill-extrusion и размещения в Three.js.
 */
import { isCustomGltfAssetId } from './map3dCustomAssets';
import { catalogEntryForModelId, catalogEntryForSubtype } from './map3dModelCatalog';
import { defaultHeightForSubtype } from './extrusionHeights';

/** L2: высота в сцене, м (переопределяет L1 по subtype). */
export const RENDER_3D_HEIGHT_KEY = 'render_3d_height_m';
/** L2: вертикальное смещение основания над землёй, м. */
export const RENDER_3D_BASE_KEY = 'render_3d_base_m';
/** L2: при false объект не попадает в 3D-слои. */
export const RENDER_3D_VISIBLE_KEY = 'render_3d_visible';
/**
 * L2: путь отрисовки для точечных объектов.
 * - `extrusion` — только MapLibre fill-extrusion (без glTF)
 * - `model` — glTF / процедурная сетка в Three.js
 * - `line` — слой линии/трубы (не extrusion точки и не модель)
 */
export const RENDER_3D_STYLE_KEY = 'render_3d_style';
/** L2: id из каталога или `custom:<uuid>`; выбирает glTF, если style допускает model. */
export const RENDER_3D_MODEL_ID_KEY = 'render_3d_model_id';
/** L2: равномерный множитель размера для 3D-модели, footprint fill-extrusion и трубы линии (1 = по умолчанию). */
export const RENDER_3D_SCALE_KEY = 'render_3d_scale';

export const DEFAULT_RENDER_3D_SCALE = 1;
export const MIN_RENDER_3D_SCALE = 0.1;
export const MAX_RENDER_3D_SCALE = 10;

/** Разрешённые параметры L2 с подстановкой L1 — вход в цепочку высота × scale. */
export type Render3DConfig = {
  heightM: number;
  baseM: number;
  visible: boolean;
  scale: number;
};

/** Итоговая высота в сцене, м: высота L2 × scale — общая для fill-extrusion и Three.js. */
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

/** Ограничить scale L2 диапазоном [MIN, MAX]; невалидное или отсутствующее → DEFAULT_RENDER_3D_SCALE. */
function readPositiveScale(props: Record<string, unknown> | undefined): number {
  const raw = readNumber(props, RENDER_3D_SCALE_KEY);
  if (raw == null || raw <= 0) return DEFAULT_RENDER_3D_SCALE;
  return Math.min(MAX_RENDER_3D_SCALE, Math.max(MIN_RENDER_3D_SCALE, raw));
}

/** Собрать L1 по subtype и переопределения L2 в Render3DConfig. */
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

/** Заполнить отсутствующие ключи L2 значениями L1 перед create/update (пользовательские значения не перезаписываются). */
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

/**
 * Рисовать ли точку как glTF / процедурную модель в Three.js.
 * false для style `extrusion` / `line`, неизвестных subtype без каталога или без model id.
 */
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
 * Создавать ли для точки полигон MapLibre fill-extrusion.
 * Взаимоисключимо с моделью Three.js при включённом `showModels`:
 * extrusion побеждает, если style его задаёт, нет модели в каталоге или 3D-модели глобально отключены.
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
