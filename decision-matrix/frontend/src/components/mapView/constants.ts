import { LINE_SUBTYPES } from '../../lib/api';

export const MAP_VECTOR_RENDER_BUFFER = 120;
export const SYNC_IDLE_INFRA_THRESHOLD = 150;
/** Max wait before syncing many features to OpenLayers (requestIdleCallback). */
export const SYNC_IDLE_TIMEOUT_MS = 80;

export const LINE_SUBTYPE_SET = new Set<string>(LINE_SUBTYPES as readonly string[]);

export const STATUS_LINE_COLOR: Record<string, string> = {
  within_limit: '#4caf50',
  exceeds_limit: '#f44336',
  construction_required: '#ff9800',
};

export const HOVER_GLOW = 'rgba(33, 150, 243, 0.28)';
export const HOVER_RING_FILL = 'rgba(33, 150, 243, 0.1)';
export const HOVER_RING_STROKE = 'rgba(33, 150, 243, 0.45)';

export const LINE_VERTEX_HIT_TOLERANCE_PX = 10;

/** Совпадает с невидимым hit-кругом в pointIconStyle (radius ~16). */
export const MAP_POINT_HIT_TOLERANCE_PX = 18;

/** Точечный подтип «Узел» — отдельный слой между линиями и остальными точками. */
export const MAP_NODE_POINT_SUBTYPE = 'node';

export function isMapNodePointSubtype(subtype: string): boolean {
  return subtype === MAP_NODE_POINT_SUBTYPE;
}

/** Порядок отрисовки: линии → узлы → прочие точки. */
export const MAP_LAYER_Z = {
  radius: 1,
  line: 3,
  nodePoint: 4,
  point: 5,
  connection: 6,
  placementPreview: 7,
} as const;
