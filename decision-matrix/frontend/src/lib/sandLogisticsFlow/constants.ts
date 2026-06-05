import type {
  SandLogisticsEdgeLabelMode,
  SandLogisticsLineStyle,
  SandLogisticsNodeFilterMode,
} from './types';

export const SAND_LOGISTICS_NODE_FILTER_OPTIONS: {
  value: SandLogisticsNodeFilterMode;
  label: string;
}[] = [
  { value: 'all_planned', label: 'Все с планом' },
  { value: 'in_service', label: 'Только введённые' },
  { value: 'allocated_only', label: 'С отгрузкой' },
];

export const SAND_LOGISTICS_LINE_STYLE_OPTIONS: {
  value: SandLogisticsLineStyle;
  label: string;
}[] = [
  { value: 'straight', label: 'Прямые' },
  { value: 'bezier', label: 'Изгибы' },
  { value: 'smoothstep', label: 'Ступеньки' },
];

export const SAND_LOGISTICS_EDGE_LABEL_MODE_OPTIONS: {
  value: SandLogisticsEdgeLabelMode;
  label: string;
}[] = [
  { value: 'key', label: 'Ключевые (плечо)' },
  { value: 'all', label: 'Все сегменты' },
  { value: 'hidden', label: 'Скрыть' },
];

export const SITE_W = 160;
export const SITE_H = 68;
export const SITE_GAP = 10;
export const SAND_FLOW_SITE_W = SITE_W;
export const SAND_FLOW_SITE_H = SITE_H;
export const SAND_FLOW_SITE_GAP = SITE_GAP;

export const NET_SIZE = 10;
export const SAND_FLOW_NET_SIZE = NET_SIZE;

export const LAYOUT_W = 1600;
export const LAYOUT_H = 1000;
export const PADDING = 80;
export const ROAD_CLEARANCE = 24;
export const ROAD_CLEARANCE_FINAL = 26;
export const NODE_CLEARANCE_BASE = 52;
export const GEO_PULL = 0.06;
export const FINAL_GEO_PULL = 0.32;
export const NODE_REPEL_RADIUS_PX = 140;
export const GEO_FRAME_MARGIN = 0.14;
export const MIN_GEO_SPAN = 0.006;

export const SAND_FLOW_MAX_GEO_DRIFT = Math.min(220, 0.12 * Math.min(LAYOUT_W, LAYOUT_H));

export const DEFAULT_FLOW_VIEWPORT_PAD = 0.1;
export const DEFAULT_FLOW_VIEWPORT_MAX_ZOOM = 1.5;
export const DEFAULT_FLOW_VIEWPORT_W = 720;
export const DEFAULT_FLOW_VIEWPORT_H = 520;

export const YEAR_LANE_SPACING = 36;
