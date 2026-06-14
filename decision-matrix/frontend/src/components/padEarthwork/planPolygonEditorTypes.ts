import type { PlanSketchPan } from '../../lib/planSketchViewport';
import type {
  EnvelopeWrapParams,
  PlanPolygonSketch,
  PlanVertex,
  PolygonEditTool,
} from '../../lib/padEarthworkSketch';
import type { PadDemPreview } from '../../lib/padEarthworkDemPreview';

export interface PlanPolygonEditorProps {
  sketch: PlanPolygonSketch;
  onChange: (sketch: PlanPolygonSketch) => void;
  tool?: PolygonEditTool;
  snapEnabled?: boolean;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  viewPan?: PlanSketchPan;
  onViewPanChange?: (pan: PlanSketchPan) => void;
  fitViewNonce?: number;
  readOnly?: boolean;
  envelope?: EnvelopeWrapParams | null;
  showEdgeLengths?: boolean;
  wellsLocal?: PlanVertex[];
  showDemOverlay?: boolean;
  demPreview?: PadDemPreview | null;
  demPreviewLoading?: boolean;
}

export type PolygonDragState =
  | {
      type: 'vertex';
      index: number;
      pointerStartEast: number;
      pointerStartNorth: number;
    }
  | {
      type: 'edge';
      edgeIndex: number;
      pointerStartEast: number;
      pointerStartNorth: number;
      edgeStartA: { east_m: number; north_m: number };
      edgeStartB: { east_m: number; north_m: number };
    };
