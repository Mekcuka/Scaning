import type { MutableRefObject, RefObject } from 'react';
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
import type { InfraLayer, InfraObject, POI } from '../../lib/api';
import type { LineDisplayLod } from '../../lib/mapLineLod';
import type { InfraPointSnapIndex } from '../../lib/infraSnapIndex';
import type { MapViewStateId } from '../../lib/mapViewState';
import type {
  DrawMode,
  SelectMode,
  MapFeatureSelection,
  LinkedLineDragState,
  LineModifySession,
  MapViewProps,
} from './types';

export type MapViewRefs = {
  layersRef: MutableRefObject<InfraLayer[]>;
  infraObjectsRef: MutableRefObject<InfraObject[]>;
  infraSnapPoolRef: MutableRefObject<InfraObject[] | undefined>;
  poisRef: MutableRefObject<POI[]>;
  syncInfraDataToLayersRef: MutableRefObject<(() => void) | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  mapRef: MutableRefObject<OlMap | null>;
  pointSourceRef: MutableRefObject<VectorSource>;
  lineSourceRef: MutableRefObject<VectorSource>;
  radiusSourceRef: MutableRefObject<VectorSource>;
  placementPreviewSourceRef: MutableRefObject<VectorSource>;
  connectionSourceRef: MutableRefObject<VectorSource>;
  selectRef: MutableRefObject<Select | null>;
  modifyRef: MutableRefObject<Modify | null>;
  translateRef: MutableRefObject<Translate | null>;
  dragBoxRef: MutableRefObject<DragBox | null>;
  dragPanRef: MutableRefObject<DragPan | null>;
  pointLayerRef: MutableRefObject<VectorLayer<VectorSource> | null>;
  lineLayerRef: MutableRefObject<VectorLayer<VectorSource> | null>;
  basemapLayerRef: MutableRefObject<TileLayer | null>;
  hoveredIdRef: MutableRefObject<string | null>;
  onMapClickRef: MutableRefObject<MapViewProps['onMapClick']>;
  onPointerMoveRef: MutableRefObject<MapViewProps['onPointerMove']>;
  onPointerLeaveRef: MutableRefObject<MapViewProps['onPointerLeave']>;
  onFeatureSelectRef: MutableRefObject<MapViewProps['onFeatureSelect']>;
  onFeatureGroupSelectRef: MutableRefObject<MapViewProps['onFeatureGroupSelect']>;
  dragBoxPickRef: MutableRefObject<boolean>;
  onDragBoxPickRef: MutableRefObject<MapViewProps['onDragBoxPick']>;
  onGeometryChangeRef: MutableRefObject<MapViewProps['onGeometryChange']>;
  onBatchGeometryChangeRef: MutableRefObject<MapViewProps['onBatchGeometryChange']>;
  onBboxChangeRef: MutableRefObject<MapViewProps['onBboxChange']>;
  onViewChangeRef: MutableRefObject<MapViewProps['onViewChange']>;
  onFitViewRef: MutableRefObject<MapViewProps['onFitView']>;
  onFinishLineRef: MutableRefObject<MapViewProps['onFinishLine']>;
  onFinishMeasureRef: MutableRefObject<MapViewProps['onFinishMeasure']>;
  draftLineRef: MutableRefObject<number[][]>;
  cursorMeasureOverlayRef: MutableRefObject<Overlay | null>;
  anchorMeasureOverlaysRef: MutableRefObject<Overlay[]>;
  drawModeRef: MutableRefObject<DrawMode>;
  pasteModeRef: MutableRefObject<boolean>;
  editModeRef: MutableRefObject<boolean>;
  selectModeRef: MutableRefObject<SelectMode>;
  useIconsRef: MutableRefObject<boolean>;
  suppressDataSyncRef: MutableRefObject<boolean>;
  infraIdsRef: MutableRefObject<Set<string>>;
  mapZoomRef: MutableRefObject<number>;
  lineLodRef: MutableRefObject<LineDisplayLod>;
  mapScaleDenominatorRef: MutableRefObject<number>;
  lineLodScaleThresholdRef: MutableRefObject<number>;
  snapIndexRef: MutableRefObject<InfraPointSnapIndex | null>;
  lastPointerLonLatRef: MutableRefObject<{ lon: number; lat: number } | null>;
  linkedLineDragRef: MutableRefObject<LinkedLineDragState | null>;
  lineModifySessionRef: MutableRefObject<LineModifySession | null>;
  modifySessionRef: MutableRefObject<number>;
  translateSessionRef: MutableRefObject<number>;
  translateStartGeomsRef: MutableRefObject<
    Map<string, { sel: MapFeatureSelection; lon: number; lat: number; coords?: number[][] }>
  >;
  suppressMapClickRef: MutableRefObject<boolean>;
  lineRightClickRef: MutableRefObject<{ at: number; x: number; y: number }>;
  persistViewStateRef: MutableRefObject<boolean>;
  onViewStateSnapshotRef: MutableRefObject<MapViewProps['onViewStateSnapshot']>;
  viewStateIdRef: MutableRefObject<MapViewStateId | undefined>;
  viewStateScopeRef: MutableRefObject<string | null | undefined>;
  projectIdRef: MutableRefObject<string | null | undefined>;
  prevProjectIdForViewRef: MutableRefObject<string | null | undefined>;
};
