import { useRef } from 'react';
import OlMap from 'ol/Map';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Select from 'ol/interaction/Select';
import Modify from 'ol/interaction/Modify';
import Translate from 'ol/interaction/Translate';
import DragBox from 'ol/interaction/DragBox';
import DragPan from 'ol/interaction/DragPan';
import Overlay from 'ol/Overlay';
import { DEFAULT_LINE_LOD_SCALE_THRESHOLD } from '../../lib/mapLineLod';
import type { LineDisplayLod } from '../../lib/mapLineLod';
import { InfraPointSnapIndex } from '../../lib/infraSnapIndex';
import { useAppStore } from '../../store';
import type { MapViewRefs } from './mapViewRefs';
import type { LinkedLineDragState, LineModifySession, MapFeatureSelection, MapViewProps } from './types';

export function useMapViewRefs(props: MapViewProps): MapViewRefs {
  const {
    layers = [],
    infraObjects = [],
    infraSnapPool,
    pois = [],
    onMapClick,
    onPointerMove,
    onPointerLeave,
    onFeatureSelect,
    onFeatureGroupSelect,
    dragBoxPick = false,
    onDragBoxPick,
    onGeometryChange,
    onBatchGeometryChange,
    onBboxChange,
    onViewChange,
    onFitView,
    onFinishLine,
    onFinishMeasure,
    draftLine = [],
    drawMode = 'select',
    pasteMode = false,
    editMode = false,
    selectMode = 'single',
    useMapIcons = true,
    lineLodScaleThreshold = DEFAULT_LINE_LOD_SCALE_THRESHOLD,
    persistViewState = true,
    onViewStateSnapshot,
    viewStateId,
    viewStateScope = null,
    infraSymbology = 'points',
  } = props;

  const projectId = useAppStore((s) => s.currentProjectId);

  const layersRef = useRef(layers);
  layersRef.current = layers;
  const infraObjectsRef = useRef(infraObjects);
  infraObjectsRef.current = infraObjects;
  const infraSnapPoolRef = useRef(infraSnapPool);
  infraSnapPoolRef.current = infraSnapPool;
  const poisRef = useRef(pois);
  poisRef.current = pois;
  const syncInfraDataToLayersRef = useRef<(() => void) | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<OlMap | null>(null);
  const pointSourceRef = useRef(new VectorSource());
  const nodePointSourceRef = useRef(new VectorSource());
  const lineSourceRef = useRef(new VectorSource());
  const radiusSourceRef = useRef(new VectorSource());
  const placementPreviewSourceRef = useRef(new VectorSource());
  const connectionSourceRef = useRef(new VectorSource());
  const padFootprintSourceRef = useRef(new VectorSource());
  const selectRef = useRef<Select | null>(null);
  const modifyRef = useRef<Modify | null>(null);
  const translateRef = useRef<Translate | null>(null);
  const dragBoxRef = useRef<DragBox | null>(null);
  const dragPanRef = useRef<DragPan | null>(null);
  const pointLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const nodePointLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const lineLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const padFootprintLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const basemapLayerRef = useRef<TileLayer | null>(null);
  const hoveredIdRef = useRef<string | null>(null);
  const onMapClickRef = useRef(onMapClick);
  const onPointerMoveRef = useRef(onPointerMove);
  const onPointerLeaveRef = useRef(onPointerLeave);
  const onFeatureSelectRef = useRef(onFeatureSelect);
  const onFeatureGroupSelectRef = useRef(onFeatureGroupSelect);
  const dragBoxPickRef = useRef(dragBoxPick);
  const onDragBoxPickRef = useRef(onDragBoxPick);
  const onGeometryChangeRef = useRef(onGeometryChange);
  const onBatchGeometryChangeRef = useRef(onBatchGeometryChange);
  const onBboxChangeRef = useRef(onBboxChange);
  const onViewChangeRef = useRef(onViewChange);
  const onFitViewRef = useRef(onFitView);
  const onFinishLineRef = useRef(onFinishLine);
  const onFinishMeasureRef = useRef(onFinishMeasure);
  const draftLineRef = useRef(draftLine);
  const cursorMeasureOverlayRef = useRef<Overlay | null>(null);
  const anchorMeasureOverlaysRef = useRef<Overlay[]>([]);
  const drawModeRef = useRef(drawMode);
  const pasteModeRef = useRef(pasteMode);
  const editModeRef = useRef(editMode);
  const selectModeRef = useRef(selectMode);
  const useIconsRef = useRef(useMapIcons);
  const infraSymbologyRef = useRef(infraSymbology);
  infraSymbologyRef.current = infraSymbology;
  const suppressDataSyncRef = useRef(false);
  const infraIdsRef = useRef<Set<string>>(new Set());
  const mapZoomRef = useRef(12);
  const lineLodRef = useRef<LineDisplayLod>('full');
  const mapScaleDenominatorRef = useRef(1);
  const lineLodScaleThresholdRef = useRef(lineLodScaleThreshold);
  lineLodScaleThresholdRef.current = lineLodScaleThreshold;
  const snapIndexRef = useRef<InfraPointSnapIndex | null>(null);
  const lastPointerLonLatRef = useRef<{ lon: number; lat: number } | null>(null);
  const linkedLineDragRef = useRef<LinkedLineDragState | null>(null);
  const lineModifySessionRef = useRef<LineModifySession | null>(null);
  const modifySessionRef = useRef(0);
  const translateSessionRef = useRef(0);
  const translateStartGeomsRef = useRef(
    new Map<string, { sel: MapFeatureSelection; lon: number; lat: number; coords?: number[][] }>(),
  );
  const suppressMapClickRef = useRef(false);
  const lineRightClickRef = useRef({ at: 0, x: 0, y: 0 });
  const persistViewStateRef = useRef(persistViewState);
  persistViewStateRef.current = persistViewState;
  const onViewStateSnapshotRef = useRef(onViewStateSnapshot);
  onViewStateSnapshotRef.current = onViewStateSnapshot;
  const viewStateIdRef = useRef(viewStateId);
  const viewStateScopeRef = useRef(viewStateScope);
  const projectIdRef = useRef(projectId);
  const prevProjectIdForViewRef = useRef<string | null | undefined>(undefined);

  viewStateIdRef.current = viewStateId;
  viewStateScopeRef.current = viewStateScope;
  projectIdRef.current = projectId;

  onMapClickRef.current = onMapClick;
  onPointerMoveRef.current = onPointerMove;
  onPointerLeaveRef.current = onPointerLeave;
  onFeatureSelectRef.current = onFeatureSelect;
  onFeatureGroupSelectRef.current = onFeatureGroupSelect;
  dragBoxPickRef.current = dragBoxPick;
  onDragBoxPickRef.current = onDragBoxPick;
  onGeometryChangeRef.current = onGeometryChange;
  onBatchGeometryChangeRef.current = onBatchGeometryChange;
  onBboxChangeRef.current = onBboxChange;
  onViewChangeRef.current = onViewChange;
  onFitViewRef.current = onFitView;
  onFinishLineRef.current = onFinishLine;
  onFinishMeasureRef.current = onFinishMeasure;
  draftLineRef.current = draftLine;
  drawModeRef.current = drawMode;
  pasteModeRef.current = pasteMode;
  editModeRef.current = editMode;
  selectModeRef.current = selectMode;
  useIconsRef.current = useMapIcons;

  return {
    layersRef,
    infraObjectsRef,
    infraSnapPoolRef,
    poisRef,
    syncInfraDataToLayersRef,
    containerRef,
    mapRef,
    pointSourceRef,
    nodePointSourceRef,
    lineSourceRef,
    radiusSourceRef,
    placementPreviewSourceRef,
    connectionSourceRef,
    padFootprintSourceRef,
    selectRef,
    modifyRef,
    translateRef,
    dragBoxRef,
    dragPanRef,
    pointLayerRef,
    nodePointLayerRef,
    lineLayerRef,
    padFootprintLayerRef,
    basemapLayerRef,
    hoveredIdRef,
    onMapClickRef,
    onPointerMoveRef,
    onPointerLeaveRef,
    onFeatureSelectRef,
    onFeatureGroupSelectRef,
    dragBoxPickRef,
    onDragBoxPickRef,
    onGeometryChangeRef,
    onBatchGeometryChangeRef,
    onBboxChangeRef,
    onViewChangeRef,
    onFitViewRef,
    onFinishLineRef,
    onFinishMeasureRef,
    draftLineRef,
    cursorMeasureOverlayRef,
    anchorMeasureOverlaysRef,
    drawModeRef,
    pasteModeRef,
    editModeRef,
    selectModeRef,
    useIconsRef,
    infraSymbologyRef,
    suppressDataSyncRef,
    infraIdsRef,
    mapZoomRef,
    lineLodRef,
    mapScaleDenominatorRef,
    lineLodScaleThresholdRef,
    snapIndexRef,
    lastPointerLonLatRef,
    linkedLineDragRef,
    lineModifySessionRef,
    modifySessionRef,
    translateSessionRef,
    translateStartGeomsRef,
    suppressMapClickRef,
    lineRightClickRef,
    persistViewStateRef,
    onViewStateSnapshotRef,
    viewStateIdRef,
    viewStateScopeRef,
    projectIdRef,
    prevProjectIdForViewRef,
  };
}
