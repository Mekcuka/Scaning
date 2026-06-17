export type Map3dQuality = 'full' | 'balanced' | 'performance';

export const DEFAULT_MAP3D_QUALITY: Map3dQuality = 'balanced';

export function tubeSegmentCapForQuality(quality: Map3dQuality): number {
  switch (quality) {
    case 'full':
      return 64;
    case 'balanced':
      return 40;
    case 'performance':
      return 16;
    default:
      return 40;
  }
}

export function tubeMinSegmentsForQuality(quality: Map3dQuality): number {
  switch (quality) {
    case 'full':
      return 8;
    case 'balanced':
      return 6;
    case 'performance':
      return 4;
    default:
      return 6;
  }
}

/** Meters per tubular segment along the path — lower quality = coarser. */
export function tubeLengthStepMForQuality(quality: Map3dQuality): number {
  switch (quality) {
    case 'full':
      return 8;
    case 'balanced':
      return 14;
    case 'performance':
      return 32;
    default:
      return 14;
  }
}

export function tubeRadialSegmentsForQuality(base: number, quality: Map3dQuality): number {
  const n = Math.max(4, base);
  switch (quality) {
    case 'full':
      return n;
    case 'balanced':
      return Math.max(4, Math.round(n * 0.55));
    case 'performance':
      return 4;
    default:
      return Math.max(4, Math.round(n * 0.55));
  }
}

export function computeLineTubeSegmentCount(
  pathLengthM: number,
  quality: Map3dQuality,
): number {
  const cap = tubeSegmentCapForQuality(quality);
  const step = tubeLengthStepMForQuality(quality);
  const minSeg = tubeMinSegmentsForQuality(quality);
  return Math.max(minSeg, Math.min(cap, Math.ceil(Math.max(1, pathLengthM) / step)));
}

export function powerLineWireSegmentsForQuality(spanLenM: number, quality: Map3dQuality): number {
  const len = Math.max(1, spanLenM);
  switch (quality) {
    case 'full':
      return Math.max(12, Math.min(40, Math.ceil(len / 5)));
    case 'balanced':
      return Math.max(6, Math.min(20, Math.ceil(len / 12)));
    case 'performance':
      return Math.max(2, Math.min(8, Math.ceil(len / 28)));
    default:
      return Math.max(6, Math.min(20, Math.ceil(len / 12)));
  }
}

export function powerLineWireRadialForQuality(quality: Map3dQuality): number {
  switch (quality) {
    case 'full':
      return 8;
    case 'balanced':
      return 5;
    case 'performance':
      return 3;
    default:
      return 5;
  }
}

/** Viewport culling: off on «Полное», on for lighter presets (see data-model.md). */
export function cullingEnabledForQuality(quality: Map3dQuality): boolean {
  return quality !== 'full';
}

/**
 * GPU instancing for repeated bundled glTF (target: «Полное»).
 * Временно выключено: instanced-путь давал артефакты на точечных моделях
 * (нулевые матрицы culled-инстансов, merge без vertex colors).
 */
export function instancingEnabledForQuality(_quality: Map3dQuality): boolean {
  return false;
}

/** Full preset: no depth bias on models (original sharp shading). */
export function modelUsesPolygonOffset(_quality: Map3dQuality): boolean {
  return false;
}

export function resolveModelRepresentation(
  _zoom: number,
  _quality: Map3dQuality,
  hasGltf: boolean,
): 'gltf' | 'procedural' {
  if (!hasGltf) return 'procedural';
  return 'gltf';
}

/** Point models: original vertex palette at every preset (quality affects lines only). */
export function modelUsesFlatShading(_quality: Map3dQuality): boolean {
  return false;
}
