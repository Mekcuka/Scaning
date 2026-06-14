import type { UseMutationResult } from '@tanstack/react-query';
import type { PadEarthworkComputeResult, PadDemPreview } from '../../lib/api/padEarthworkApi';
import type {
  PlanEditTool,
  PlanPolygonSketch,
  PlanRectangleSketch,
  PlanShapeSketch,
  PlanVertex,
  PolygonEditTool,
  ShapeMode,
} from '../../lib/padEarthworkSketch';
import type { PlanSketchPan } from '../../lib/planSketchViewport';
import type { GeneratorFields } from './padEarthworkSketchModalState';

export type PadEarthworkSketchDemToolbarProps = {
  showDemOverlay: boolean;
  onShowDemOverlayChange: (value: boolean) => void;
  demAvailable: boolean;
  onFetchDem: () => void;
  fetchDemPending: boolean;
  readOnly: boolean;
};

export type PadEarthworkSketchPlanTabProps = {
  projectId: string;
  objectId: string;
  showGenerator: boolean;
  readOnly: boolean;
  shapeMode: ShapeMode;
  handleShapeModeChange: (mode: ShapeMode) => void;
  rectTool: PlanEditTool;
  setRectTool: (tool: PlanEditTool) => void;
  polygonTool: PolygonEditTool;
  setPolygonTool: (tool: PolygonEditTool) => void;
  snapEnabled: boolean;
  setSnapEnabled: (value: boolean) => void;
  lockAspect: boolean;
  setLockAspect: (value: boolean) => void;
  showEdgeLengths: boolean;
  setShowEdgeLengths: (value: boolean) => void;
  zoom: number;
  setZoom: (value: number | ((prev: number) => number)) => void;
  viewPan: PlanSketchPan;
  setViewPan: (value: PlanSketchPan) => void;
  fitViewNonce: number;
  handleFitView: () => void;
  handleResetSketch: () => void;
  handleClearPolygon: () => void;
  demToolbarProps: PadEarthworkSketchDemToolbarProps;
  rectangleSketch: PlanRectangleSketch;
  polygonSketch: PlanPolygonSketch;
  polygonClosed: boolean;
  sketch: PlanShapeSketch;
  updateSketch: (next: PlanShapeSketch | ((prev: PlanShapeSketch) => PlanShapeSketch)) => void;
  setShapeMode: (mode: ShapeMode) => void;
  wellsLocal: PlanVertex[];
  envelopeParams: { enabled: true; wrap_width_m: number } | null;
  showDemOverlay: boolean;
  demPreviewData: PadDemPreview | null | undefined;
  demPreviewLoading: boolean;
  setPadWellCount?: (value: string) => void;
  setPadWellsPerGroup?: (value: string) => void;
  setPadWellSpacingM?: (value: string) => void;
  setPadGroupSpacingM?: (value: string) => void;
  setPadMarginLeftM?: (value: string) => void;
  setPadMarginBottomM?: (value: string) => void;
  setPadMarginTopM?: (value: string) => void;
  setPadMarginEndM?: (value: string) => void;
  setRotationDeg?: (value: string) => void;
  generatorFields: GeneratorFields;
  patchGeneratorField: <K extends keyof GeneratorFields>(key: K, value: GeneratorFields[K]) => void;
  generateMutation: UseMutationResult<
    Awaited<ReturnType<typeof import('../../lib/api/padEarthworkApi').padEarthworkApi.generateSketch>>,
    Error,
    void,
    unknown
  >;
  areaTop: number;
  envelopeActive: boolean;
  bermPerimeterM: number | null;
  estimatedFill: number | null;
  canCompute: boolean;
  envelopeEnabled: boolean;
  setEnvelopeEnabled: (value: boolean) => void;
  wrapWidthM: number;
  setWrapWidthM: (value: number) => void;
  localHeight: string;
  setLocalHeight: (value: string) => void;
  localRef: string;
  setLocalRef: (value: string) => void;
  heightRefForPreview: { height_m: number; reference_elevation_m: number } | null;
  debouncedPreviewKey: string;
  previewRequestKey: string;
  demAvailable: boolean;
  setResult: (value: PadEarthworkComputeResult | null) => void;
  setError: (value: string | null) => void;
  result: PadEarthworkComputeResult | null;
  error: string | null;
  saveMessage: string | null;
};
