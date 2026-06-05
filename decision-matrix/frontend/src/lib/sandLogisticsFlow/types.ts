import type { Edge, Node } from '@xyflow/react';

export type SandLogisticsLineStyle = 'straight' | 'bezier' | 'smoothstep';

/** How volume labels are shown on the sand logistics schematic. */
export type SandLogisticsEdgeLabelMode = 'all' | 'key' | 'hidden';

/** Which objects appear on the sand logistics schematic. */
export type SandLogisticsNodeFilterMode = 'all_planned' | 'in_service' | 'allocated_only';

export type SandFlowNodeKind = 'quarry' | 'consumer' | 'network';

export type SandFlowNodeData = {
  kind: SandFlowNodeKind;
  label: string;
  in_service?: boolean;
  lon?: number;
  lat?: number;
  as_of?: string;
  entry_date?: string;
  /** Только потребители: спрос и жадная отгрузка для цвета блока */
  demand_m3?: number;
  demand_plan_total_m3?: number;
  allocated_m3?: number;
  /** Карьер: остаток и начальный объём на дату среза */
  remaining_m3?: number;
  initial_m3?: number;
  /** Якорь сети без видимой вершины (развилка / snap). */
  hiddenAnchor?: boolean;
};

export type SandRoadEdgeData = {
  flowM3?: number;
  labelOffsetX?: number;
  labelOffsetY?: number;
  planned?: boolean;
};

/** Упрощённая полилиния сети (цепочка без промежуточных вершин). */
export type SandRoadPolylineEdgeData = SandRoadEdgeData & {
  points: { x: number; y: number }[];
};

export type SandLegLabelNodeData = {
  kind: 'legLabel';
  flowM3: number;
};

export type SandPlannedLegLabelNodeData = {
  kind: 'plannedLegLabel';
  label: string;
};

export type SandLogisticsFlowOptions = {
  edgeLabelMode?: SandLogisticsEdgeLabelMode;
  nodeFilter?: SandLogisticsNodeFilterMode;
  showPlannedRoutes?: boolean;
  groupByEntryYear?: boolean;
  as_of?: string;
};

export type SandLogisticsFlowResult = {
  nodes: Node<SandFlowNodeData | SandLegLabelNodeData | SandPlannedLegLabelNodeData>[];
  edges: Edge[];
  summary: { total_demand_m3: number; total_allocated_m3: number; unmet_m3: number };
  entryYears: number[];
  /** Id карьеров и потребителей на схеме — для fitView по объектам. */
  siteNodeIds: string[];
  /** Начальный viewport, вписывающий объекты (не зависит от async fitView). */
  defaultViewport: { x: number; y: number; zoom: number };
};

export type SandLogisticsRoadGraph = Map<string, { neighbor: string; weight: number }[]>;

export type SandLogisticsLayoutResult = {
  topologyKey: string;
  positions: Map<string, { x: number; y: number }>;
  siteNodeIds: string[];
  defaultViewport: { x: number; y: number; zoom: number };
  roadGraph: SandLogisticsRoadGraph;
  keyNetworkNodes: Set<string>;
  layoutSiteRects: SandFlowLayoutRect[];
  entryYears: number[];
  siteSpecs: SiteSpec[];
};

export type SandLogisticsLayoutOptions = Pick<
  SandLogisticsFlowOptions,
  'nodeFilter' | 'groupByEntryYear'
>;

export type SandSiteDensitySpread = {
  geoScaleBoost: number;
  layoutGap: number;
  maxDrift: number;
  geoMargin: number;
};

export type SandFlowLayoutRect = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type SimplifiedRoadPolyline = {
  id: string;
  nodeIds: string[];
  points: { x: number; y: number }[];
  segmentKeys: string[];
};

export type GeoFrame = {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type SiteSpec = {
  id: string;
  snapNodeId: string;
  kind: 'quarry' | 'consumer';
  lon: number;
  lat: number;
  entryYear: number | null;
};

export type LayoutRect = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Якорь по lon/lat объекта (px на схеме) */
  ax: number;
  ay: number;
};

export type RoadSegment = { x1: number; y1: number; x2: number; y2: number };

export type RoadGraph = Map<string, { neighbor: string; weight: number }[]>;

export type EdgePathInput = {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: import('@xyflow/react').Position;
  targetPosition: import('@xyflow/react').Position;
};
