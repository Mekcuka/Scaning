import type { AnalysisRow, InfraObject, POI } from '../../lib/api';
import type { MapViewStateId } from '../../lib/mapViewState';
import type { InfraLayer } from '../../lib/api';
import { findLineEndpointAttachment } from '../../lib/lineEndpointRules';

export type FootprintEdgeHighlight = {
  pointId: string;
  edgeIndex: number;
} | null;

export interface ThresholdCircle {
  key: string;
  km: number;
  color: string;
  visible: boolean;
}

export type DrawMode = 'select' | 'poi' | 'point' | 'line' | 'ruler' | 'autoroad_network';

export type SelectMode = 'single' | 'box';

export type MapFeatureSelection =
  | { kind: 'poi'; id: string }
  | { kind: 'infra'; id: string };

/** Pan/zoom target (change nonce to re-run animation). */
export type MapFocusTarget = {
  lon: number;
  lat: number;
  extentLonLat?: [number, number, number, number];
  nonce: number;
  /** Internal dedupe key (ReportPage). */
  focusKey?: string;
};

export type MeasureLabel = {
  lon: number;
  lat: number;
  text: string;
};

export type MapClickHit = {
  overPoint?: { lon: number; lat: number; id?: string };
  overLine?: { lineId: string; lon: number; lat: number; segmentIndex: number };
};

export type InfraSymbology = 'points' | 'footprints';

export interface MapViewProps {
  pois?: POI[];
  infraObjects?: InfraObject[];
  /** Full project list for snapping line ends (defaults to infraObjects). */
  infraSnapPool?: InfraObject[];
  /** When false, Esri tile underlay is hidden (vectors/radii remain). */
  showBasemap?: boolean;
  /** Point icons vs pad footprint polygons for earthwork-eligible infra. */
  infraSymbology?: InfraSymbology;
  drawMode?: DrawMode;
  selectMode?: SelectMode;
  onMapClick?: (lon: number, lat: number, hit?: MapClickHit) => void;
  onFinishLine?: (
    coords: number[][],
    finishAt?: { lon: number; lat: number; id?: string },
    splitHint?: { lineId: string; segmentIndex: number; snapLon?: number; snapLat?: number },
  ) => void;
  /** Double-click / finish current measure polyline (ruler mode). */
  onFinishMeasure?: () => void;
  onPointerMove?: (lon: number, lat: number, overPoint?: { lon: number; lat: number }) => void;
  onPointerLeave?: () => void;
  onFeatureSelect?: (sel: MapFeatureSelection | null) => void;
  onFeatureGroupSelect?: (sels: MapFeatureSelection[]) => void;
  /** Drag-box pick (e.g. autoroad network terminal bulk select). */
  dragBoxPick?: boolean;
  onDragBoxPick?: (sels: MapFeatureSelection[]) => void;
  onGeometryChange?: (sel: MapFeatureSelection, lon: number, lat: number, coords?: number[][]) => void;
  /** Hover highlight while picking footprint edge on point object. */
  footprintEdgeHighlight?: FootprintEdgeHighlight;
  /** Group move in box-select mode (Translate interaction). */
  onBatchGeometryChange?: (
    items: { sel: MapFeatureSelection; lon: number; lat: number; coords?: number[][] }[],
  ) => void | Promise<void>;
  onBboxChange?: (bbox: string) => void;
  onViewChange?: (info: { zoom: number; scaleLabel: string; scaleDenominator: number }) => void;
  /** Simplify lines when map scale 1:N >= this N (default 500_000). */
  lineLodScaleThreshold?: number;
  height?: string;
  connectionLines?: AnalysisRow[];
  selectedPoi?: POI | null;
  selectedFeatureId?: string | null;
  selectedFeatureIds?: string[];
  thresholdCircles?: ThresholdCircle[];
  draftLine?: number[][];
  /** Dashed segment from last draft vertex to cursor (line draw mode). */
  draftLinePreview?: [number, number] | null;
  /** Autoroad network plan overlay (before apply). */
  autoroadPlanPreviewLines?: { coordinates: number[][]; kind: string }[];
  /** Active measure polyline (lon/lat vertices). */
  measureLine?: number[][];
  measurePreview?: [number, number] | null;
  /** Finished measure polylines (stay on map until reset). */
  measureCompletedLines?: number[][][];
  /** Label following cursor while drawing. */
  measureCursorLabel?: MeasureLabel | null;
  /** Labels at finished measure endpoints. */
  measureAnchorLabels?: MeasureLabel[];
  showRadii?: boolean;
  useMapIcons?: boolean;
  layers?: InfraLayer[];
  mapFocus?: MapFocusTarget | null;
  /** Fit map extent to all visible objects (button under OL zoom controls). */
  onFitView?: () => void;
  /** When false: view-only — no drag-edit of geometries (select/view still allowed). */
  editMode?: boolean;
  /** Ghost icon at cursor while placing point infrastructure. */
  placementPreview?: { subtype: string; lon: number; lat: number } | null;
  /** Ghost markers while positioning clipboard paste. */
  clipboardPreviewPoints?: { subtype: string; lon: number; lat: number }[];
  /** When true, map click in select mode runs onMapClick (paste anchor). */
  pasteMode?: boolean;
  /** Remember pan/zoom per project when leaving the page (main / matrix / report). */
  viewStateId?: MapViewStateId;
  /** Optional sub-key (e.g. POI id on the report map). */
  viewStateScope?: string | null;
  /** When false, do not restore or save pan/zoom (report preview always fits via mapFocus). */
  persistViewState?: boolean;
  /** Latest 2D center/zoom (e.g. for 2D→3D camera sync). */
  onViewStateSnapshot?: (state: { centerLon: number; centerLat: number; zoom: number }) => void;
}

export type LinkedLineDragState = {
  sessionId: number;
  links: { lineId: string; start: boolean; end: boolean; pointId: string }[];
};

export type LineModifySession = {
  sessionId: number;
  lineId: string;
  subtype: string;
  originalStart: [number, number];
  originalFinish: [number, number];
  originalStartAttach: ReturnType<typeof findLineEndpointAttachment>;
  originalFinishAttach: ReturnType<typeof findLineEndpointAttachment>;
};
