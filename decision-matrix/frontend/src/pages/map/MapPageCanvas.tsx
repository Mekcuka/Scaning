import { lazy, Suspense, useMemo, type MutableRefObject } from 'react';
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
import type { MeasureLabel, FootprintEdgeHighlight } from '../../components/mapView/types';
import { previewSegmentMeasureLabel } from '../../lib/mapMeasure';
const MapView3D = lazy(() => import('../../components/MapView3D'));

type AutoroadPreviewLine = { coordinates: number[][]; kind: string };

export type MapPageCanvasProps = {
  map3dRef: MutableRefObject<MapView3DHandle | null>;
  map3dFeatureEnabled: boolean;
  map3dKeepMounted: boolean;
  mapIn3d: boolean;
  infraSymbology: 'points' | 'footprints';
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
  footprintEdgeHighlight?: FootprintEdgeHighlight;
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
  wellTrajectoryFeatures: import('../../lib/api/wellTrajectoryApi').WellTrajectoryGeoJsonFeature[];
  showWellTrajectories: boolean;
  showWellBottomholes: boolean;
  showWellTrajectories3d: boolean;
  isBottomholeDrawActive: boolean;
  gsHeelDraft: { lon: number; lat: number } | null;
  padPlacementPreviewFeatures: {
    coordinates: number[] | number[][] | number[][][];
    geometryType: string;
    kind: string;
  }[];
  padPlacementBottomholeIds: string[];
  handlePadPlacementDragBoxPick: (selections: MapFeatureSelection[]) => void;
};

export function MapPageCanvas({
  map3dRef,
  map3dFeatureEnabled,
  map3dKeepMounted,
  mapIn3d,
  infraSymbology,
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
  footprintEdgeHighlight,
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
  wellTrajectoryFeatures,
  showWellTrajectories,
  showWellBottomholes,
  showWellTrajectories3d,
  isBottomholeDrawActive,
  gsHeelDraft,
  padPlacementPreviewFeatures,
  padPlacementBottomholeIds,
  handlePadPlacementDragBoxPick,
}: MapPageCanvasProps) {
  const visiblePois = showPoisOnMap ? pois : [];
  const gsBottomholePreviewLines =
    drawMode === 'bottomhole_gs' && gsHeelDraft && cursor
      ? [
          {
            coordinates: [
              [gsHeelDraft.lon, gsHeelDraft.lat],
              [cursor.lon, cursor.lat],
            ],
          },
        ]
      : [];

  const gsBottomholePreviewPoints = useMemo(() => {
    if (drawMode !== 'bottomhole_gs' || !gsHeelDraft) return [];
    return [
      {
        subtype: 'well_bottomhole_gs_heel',
        lon: gsHeelDraft.lon,
        lat: gsHeelDraft.lat,
      },
    ];
  }, [drawMode, gsHeelDraft]);

  const effectiveMeasureCursorLabel = useMemo((): MeasureLabel | null => {
    if (measureCursorLabel) return measureCursorLabel;
    if (drawMode === 'bottomhole_gs' && gsHeelDraft && cursor) {
      return previewSegmentMeasureLabel(gsHeelDraft, cursor);
    }
    return null;
  }, [measureCursorLabel, drawMode, gsHeelDraft, cursor]);

  return (
    <>
      {map3dFeatureEnabled && (map3dKeepMounted || mapIn3d) && (
        <div
          className="map-3d-host"
          style={{
            visibility: mapIn3d ? 'visible' : 'hidden',
            pointerEvents: mapIn3d ? 'auto' : 'none',
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
              selectedPoi={selectedPoi}
              selectedFeatureId={featureSel?.id ?? null}
              onFeatureSelect={
                drawMode === 'select' && selectMode === 'single' ? setFeatureSel : undefined
              }
              thresholdCircles={thresholdCircles}
              showRadii={showRadii}
              layers={layers}
              mapFocus={mapFocus}
              wellTrajectoryFeatures={wellTrajectoryFeatures}
              showWellTrajectories3d={showWellTrajectories3d}
              showWellBottomholes={showWellBottomholes}
              height="100%"
            />
          </Suspense>
        </div>
      )}
      {!mapIn3d && (
        <MapView
          viewStateId="main"
          onViewStateSnapshot={onViewStateSnapshot}
          infraSymbology={infraSymbology}
          pois={visiblePois}
          infraObjects={filteredInfra}
          infraSnapPool={infraObjects}
          showBasemap={showBasemap}
          drawMode={drawMode}
          selectMode={selectMode}
          editMode={mapEditEnabled}
          onMapClick={
            pasteMode ||
            isBottomholeDrawActive ||
            drawMode === 'ruler' ||
            drawMode === 'autoroad_network' ||
            drawMode === 'pad_placement' ||
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
                : drawMode === 'bottomhole_nnb'
                  ? { subtype: 'well_bottomhole_nnb', lon: cursor.lon, lat: cursor.lat }
                  : drawMode === 'bottomhole_gs'
                    ? {
                        subtype: gsHeelDraft ? 'well_bottomhole_gs_toe' : 'well_bottomhole_gs_heel',
                        lon: cursor.lon,
                        lat: cursor.lat,
                      }
                    : drawMode === 'poi'
                      ? { subtype: 'poi', lon: cursor.lon, lat: cursor.lat }
                      : null
              : null
          }
          placementPreviewPoints={gsBottomholePreviewPoints}
          clipboardPreviewPoints={clipboardPreviewPoints}
          pasteMode={pasteMode}
          onFeatureSelect={
            drawMode === 'select' && selectMode === 'single' ? setFeatureSel : undefined
          }
          onFeatureGroupSelect={
            drawMode === 'select' && selectMode === 'box' ? setFeatureGroupSel : undefined
          }
          dragBoxPick={
            (drawMode === 'autoroad_network' && autoroadNetworkPickMode === 'box') ||
            drawMode === 'pad_placement'
          }
          onDragBoxPick={
            drawMode === 'autoroad_network'
              ? handleAutoroadNetworkDragBoxPick
              : drawMode === 'pad_placement'
                ? handlePadPlacementDragBoxPick
                : undefined
          }
          selectedFeatureIds={
            drawMode === 'autoroad_network'
              ? autoroadNetworkTerminalIds
              : drawMode === 'pad_placement'
                ? padPlacementBottomholeIds
                : featureGroupSel.map((s) => s.id)
          }
          onGeometryChange={mapEditEnabled ? handleGeometryChange : undefined}
          footprintEdgeHighlight={footprintEdgeHighlight}
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
          gsBottomholePreviewLines={gsBottomholePreviewLines}
          autoroadPlanPreviewLines={autoroadPlanPreviewLines}
          padPlacementPreviewFeatures={padPlacementPreviewFeatures}
          measureLine={rulerPoints}
          measurePreview={rulerPreview}
          measureCompletedLines={rulerCompleted}
          measureCursorLabel={effectiveMeasureCursorLabel}
          measureAnchorLabels={measureAnchorLabels}
          showRadii={showRadii}
          useMapIcons
          layers={layers}
          mapFocus={mapFocus}
          onFitView={handleFitMapView}
          lineLodScaleThreshold={lineLodScaleThreshold}
          wellTrajectoryFeatures={wellTrajectoryFeatures}
          showWellTrajectories={showWellTrajectories}
          showWellBottomholes={showWellBottomholes}
          onViewChange={onViewChange}
        />
      )}
    </>
  );
}
