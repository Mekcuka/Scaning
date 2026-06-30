/**
 * Пресеты качества 3D-слоя (Three.js): плотность геометрии линий/труб, viewport culling, GPU instancing.
 * Точечные glTF-модели не упрощаются по пресету — качество влияет в основном на линии и ЛЭП.
 */
export type Map3dQuality = 'full' | 'balanced' | 'performance';

/** Пресет по умолчанию в UI и слоях карты. */
export const DEFAULT_MAP3D_QUALITY: Map3dQuality = 'balanced';

/**
 * Верхняя граница сегментов вдоль оси трубы (TubeGeometry).
 * full — гладкие длинные трассы; performance — жёсткий потолок для FPS.
 */
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

/** Минимум сегментов вдоль трубы даже на коротком участке (избегаем «ломаных» углов). */
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

/** Шаг вдоль пути, м на один сегмент трубы — чем грубее пресет, тем реже точки по длине. */
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

/**
 * Радиальные сегменты поперечного сечения трубы (окружность).
 * balanced ≈ 55% от базового каталога; performance фиксирует 4 (минимально читаемый круг).
 */
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

/**
 * Число сегментов трубы по длине пути: clamp(minSeg, ceil(length/step), cap).
 * Используется для линий инфраструктуры и траекторий скважин.
 */
export function computeLineTubeSegmentCount(
  pathLengthM: number,
  quality: Map3dQuality,
): number {
  const cap = tubeSegmentCapForQuality(quality);
  const step = tubeLengthStepMForQuality(quality);
  const minSeg = tubeMinSegmentsForQuality(quality);
  return Math.max(minSeg, Math.min(cap, Math.ceil(Math.max(1, pathLengthM) / step)));
}

/**
 * Сегменты провода ЛЭП вдоль пролёта (кривая провисания).
 * Делитель в ceil(len/divisor): full 5 м, balanced 12 м, performance 28 м; границы min/max на пресет.
 */
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

/** Радиальные сегменты цилиндра провода ЛЭП (толщина «жилы» в сечении). */
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

/**
 * Viewport culling: выключен на «Полное» (full), включён на balanced/performance.
 * Объекты вне видимой области MapLibre не попадают в draw-call (см. map3dViewportCull).
 */
export function cullingEnabledForQuality(quality: Map3dQuality): boolean {
  return quality !== 'full';
}

/**
 * GPU instancing для повторяющихся bundled glTF (целевой режим — пресет full).
 * Временно выключено на всех пресетах: instanced-путь давал артефакты на точечных моделях
 * (нулевые матрицы culled-инстансов, merge без vertex colors).
 */
export function instancingEnabledForQuality(_quality: Map3dQuality): boolean {
  return false;
}

/**
 * Polygon offset на моделях (смещение depth для борьбы с z-fighting).
 * Сейчас отключён на всех пресетах — исходное резкое затенение без bias.
 */
export function modelUsesPolygonOffset(_quality: Map3dQuality): boolean {
  return false;
}

/**
 * Выбор представления точки: glTF из каталога или процедурная заглушка.
 * zoom/quality зарезервированы под LOD; пока при наличии glTF всегда glTF.
 */
export function resolveModelRepresentation(
  _zoom: number,
  _quality: Map3dQuality,
  hasGltf: boolean,
): 'gltf' | 'procedural' {
  if (!hasGltf) return 'procedural';
  return 'gltf';
}

/** Точечные модели: исходная палитра вершин на любом пресете (flat shading не применяется). */
export function modelUsesFlatShading(_quality: Map3dQuality): boolean {
  return false;
}
