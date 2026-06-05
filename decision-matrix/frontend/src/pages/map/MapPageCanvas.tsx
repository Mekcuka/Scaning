import { lazy, Suspense, type MutableRefObject } from 'react';
import {
  MapView,
  type DrawMode,
  type MapClickHit,
  type MapFeatureSelection,
  type MapFocusTarget,
  type SelectMode,
  type ThresholdCircle,
} from '../../components/MapView';
import type { MapView3DHandle } from '../../components/MapView3D';
import type { AnalysisRow, InfraLayer, InfraObject, POI } from '../../lib/api';
import type { SavedMapViewState } from '../../lib/mapViewState';
import type { MeasureLabel } from '../../components/mapView/types';
const MapView3D = lazy(() => import('../../components/MapView3D'));

type AutoroadPreviewLine = { coordinates: number[][]; kind: string };

export type MapPageCanvasProps = {
  map3dRef: MutableRefObject<MapView3DHandle | null>;
  map3dFeatureEnabled: boolean;
  map3dKeepMounted: boolean;
  mapIn3d: boolean;
  showPoisOnMap: boolean;
  pois: POI[];
  filteredInfra: InfraObject[];
  infraObjects: InfraObject[];
  showBasemap: boolean;
  showTerrain: boolean;
  showModels: boolean;
  connectionLines: AnalysisRow[];
  selectedPoi: POI | null;
  featureSel: MapFeatureSelection | null;
  setFeatureSel: (sel: MapFeatureSelection | null) => void;
  thresholdCircles: ThresholdCircle[];
  showRadii: boolean;
  layers: InfraLayer[];
  mapFocus: MapFocusTarget | null;
  drawMode: DrawMode;
  selectMode: SelectMode;
  mapEditEnabled: boolean;
  projectId: string | undefined;
  pasteMode: boolean;
  handleMapClick: (lon: number, lat: number, hit?: MapClickHit) => void;
  finishLineDraft: (
    coords: number[][],
    finishAt?: { lon: number; lat: number; id?: string },
    splitHint?: { lineId: string; segmentIndex: number; snapLon?: number; snapLat?: number },
  ) => void | Promise<void>;
  finishRulerMeasurement: (showToast: boolean) => void;
  handlePointerMove: (lon: number, lat: number, overPoint?: { lon: number; lat: number }) => void;
  handlePointerLeave: () => void;
  mapPointerInside: boolean;
  cursor: { lon: number; lat: number } | null;
  infraFormSubtype: string;
  clipboardPreviewPoints: { subtype: string; lon: number; lat: number }[];
  setFeatureGroupSel: (sels: MapFeatureSelection[]) => void;
  autoroadNetworkPickMode: 'click' | 'box';
  handleAutoroadNetworkDragBoxPick: (selections: MapFeatureSelection[]) => void;
  autoroadNetworkTerminalIds: string[];
  featureGroupSel: MapFeatureSelection[];
  handleGeometryChange: (
    sel: MapFeatureSelection,
    lon: number,
    lat: number,
    coords?: number[][],
  ) => void | Promise<void>;
  handleBatchGeometryChange: (
    items: { sel: MapFeatureSelection; lon: number; lat: number; coords?: number[][] }[],
  ) => void | Promise<void>;
  handleMapBboxChange: (bbox: string) => void;
  lineDraft: number[][];
  lineDraftPreview: [number, number] | null;
  autoroadPlanPreviewLines: AutoroadPreviewLine[];
  rulerPoints: number[][];
  rulerPreview: [number, number] | null;
  rulerCompleted: number[][][];
  measureCursorLabel: MeasureLabel | null;
  measureAnchorLabels: MeasureLabel[];
  handleFitMapView: () => void;
  lineLodScaleThreshold: number;
  onViewStateSnapshot: (state: SavedMapViewState) => void;
  onViewChange: (view: { scaleLabel: string; scaleDenominator: number }) => void;
};

export function MapPageCanvas({
  map3dRef,
  map3dFeatureEnabled,
  map3dKeepMounted,
  mapIn3d,
  showPoisOnMap,
  pois,
  filteredInfra,
  infraObjects,
  showBasemap,
  showTerrain,
  showModels,
  connectionLines,
  selectedPoi,
  featureSel,
  setFeatureSel,
  thresholdCircles,
  showRadii,
  layers,
  mapFocus,
  drawMode,
  selectMode,
  mapEditEnabled,
  projectId,
  pasteMode,
  handleMapClick,
  finishLineDraft,
  finishRulerMeasurement,
  handlePointerMove,
  handlePointerLeave,
  mapPointerInside,
  cursor,
  infraFormSubtype,
  clipboardPreviewPoints,
  setFeatureGroupSel,
  autoroadNetworkPickMode,
  handleAutoroadNetworkDragBoxPick,
  autoroadNetworkTerminalIds,
  featureGroupSel,
  handleGeometryChange,
  handleBatchGeometryChange,
  handleMapBboxChange,
  lineDraft,
  lineDraftPreview,
  autoroadPlanPreviewLines,
  rulerPoints,
  rulerPreview,
  rulerCompleted,
  measureCursorLabel,
  measureAnchorLabels,
  handleFitMapView,
  lineLodScaleThreshold,
  onViewStateSnapshot,
  onViewChange,
}: MapPageCanvasProps) {
  const visiblePois = showPoisOnMap ? pois : [];

  return (
    <>
      {map3dFeatureEnabled && (map3dKeepMounted || mapIn3d) && (
        <div
          className="map-3d-host"
          style={{
            display: mapIn3d ? 'block' : 'none',
            height: '100%',
            width: '100%',
          }}
          aria-hidden={!mapIn3d}
        >
          <Suspense
            fallback={
              <div
                className="map-container flex items-center justify-center text-sm"
                style={{ height: '100%', color: 'var(--text-muted)' }}
              >
                Загрузка 3D…
              </div>
            }
          >
            <MapView3D
              ref={map3dRef}
              viewStateId="main"
              pois={visiblePois}
              infraObjects={filteredInfra}
              infraSnapPool={infraObjects}
              showBasemap={showBasemap}
              showTerrain={showTerrain}
              showModels={showModels}
              connectionLines={connectionLines}
              selectedPoi={selectedPoi}
              selectedFeatureId={featureSel?.id ?? null}
              onFeatureSelect={
                drawMode === 'select' && selectMode === 'single' ? setFeatureSel : undefined
              }
              thresholdCircles={thresholdCircles}
              showRadii={showRadii}
              layers={layers}
              mapFocus={mapFocus}
              height="100%"
            />
          </Suspense>
        </div>
      )}
      {!mapIn3d && (
        <MapView
          viewStateId="main"
          onViewStateSnapshot={onViewStateSnapshot}
          pois={visiblePois}
          infraObjects={filteredInfra}
          infraSnapPool={infraObjects}
          showBasemap={showBasemap}
          drawMode={drawMode}
          selectMode={selectMode}
          editMode={mapEditEnabled}
          onMapClick={
            pasteMode ||
            drawMode === 'ruler' ||
            drawMode === 'autoroad_network' ||
            (projectId && drawMode !== 'select')
              ? handleMapClick
              : undefined
          }
          onFinishLine={(coords, finishAt, splitHint) =>
            finishLineDraft(coords, finishAt, splitHint)
          }
          onFinishMeasure={() => {
            if (drawMode === 'ruler') finishRulerMeasurement(true);
          }}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          placementPreview={
            !pasteMode && mapPointerInside && cursor
              ? drawMode === 'point'
                ? { subtype: infraFormSubtype, lon: cursor.lon, lat: cursor.lat }
                : drawMode === 'poi'
                  ? { subtype: 'poi', lon: cursor.lon, lat: cursor.lat }
                  : null
              : null
          }
          clipboardPreviewPoints={clipboardPreviewPoints}
          pasteMode={pasteMode}
          onFeatureSelect={
            drawMode === 'select' && selectMode === 'single' ? setFeatureSel : undefined
          }
          onFeatureGroupSelect={
            drawMode === 'select' && selectMode === 'box' ? setFeatureGroupSel : undefined
          }
          dragBoxPick={drawMode === 'autoroad_network' && autoroadNetworkPickMode === 'box'}
          onDragBoxPick={
            drawMode === 'autoroad_network' ? handleAutoroadNetworkDragBoxPick : undefined
          }
          selectedFeatureIds={
            drawMode === 'autoroad_network'
              ? autoroadNetworkTerminalIds
              : featureGroupSel.map((s) => s.id)
          }
          onGeometryChange={mapEditEnabled ? handleGeometryChange : undefined}
          onBatchGeometryChange={
            mapEditEnabled && selectMode === 'box' ? handleBatchGeometryChange : undefined
          }
          onBboxChange={handleMapBboxChange}
          connectionLines={connectionLines}
          selectedPoi={selectedPoi}
          selectedFeatureId={featureSel?.id ?? null}
          thresholdCircles={thresholdCircles}
          draftLine={lineDraft}
          draftLinePreview={lineDraftPreview}
          autoroadPlanPreviewLines={autoroadPlanPreviewLines}
          measureLine={rulerPoints}
          measurePreview={rulerPreview}
          measureCompletedLines={rulerCompleted}
          measureCursorLabel={measureCursorLabel}
          measureAnchorLabels={measureAnchorLabels}
          showRadii={showRadii}
          useMapIcons
          layers={layers}
          mapFocus={mapFocus}
          onFitView={handleFitMapView}
          lineLodScaleThreshold={lineLodScaleThreshold}
          onViewChange={onViewChange}
        />
      )}
    </>
  );
}
