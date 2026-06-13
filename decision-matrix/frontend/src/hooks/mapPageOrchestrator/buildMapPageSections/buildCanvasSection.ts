import type { MapPageCanvasProps } from '../../../pages/map/MapPageCanvas';
import type { BuildMapPageSectionsParams } from './types';

export function buildCanvasSection(
  params: Pick<
    BuildMapPageSectionsParams,
    | 'projectId'
    | 'map3dFeatureEnabled'
    | 'mapIn3d'
    | 'mapInFootprints'
    | 'showPoisOnMap'
    | 'showBasemap'
    | 'showModels'
    | 'showRadii'
    | 'layerPrefs'
    | 'shell'
    | 'edit'
    | 'data'
    | 'actions'
  >,
): MapPageCanvasProps {
  const {
    projectId,
    map3dFeatureEnabled,
    mapIn3d,
    mapInFootprints,
    showPoisOnMap,
    showBasemap,
    showModels,
    showRadii,
    layerPrefs,
    shell,
    edit,
    data,
    actions,
  } = params;

  return {
    map3dRef: shell.map3dRef,
    map3dFeatureEnabled,
    map3dKeepMounted: actions.map3dKeepMounted,
    mapIn3d,
    infraSymbology: mapInFootprints ? 'footprints' : 'points',
    showPoisOnMap,
    pois: data.pois,
    filteredInfra: data.filteredInfra,
    infraObjects: data.infraObjects,
    showBasemap,
    showTerrain: false,
    showModels,
    connectionLines: actions.connectionLines,
    selectedPoi: data.selectedPoi,
    featureSel: edit.featureSel,
    setFeatureSel: edit.setFeatureSel,
    thresholdCircles: actions.thresholdCircles,
    showRadii,
    layers: data.layers,
    mapFocus: edit.mapFocus,
    drawMode: edit.drawMode,
    selectMode: edit.selectMode,
    mapEditEnabled: edit.mapEditEnabled,
    projectId: projectId ?? undefined,
    pasteMode: edit.pasteMode,
    handleMapClick: actions.handleMapClick,
    finishLineDraft: actions.finishLineDraft,
    finishRulerMeasurement: actions.finishRulerMeasurement,
    handlePointerMove: actions.handlePointerMove,
    handlePointerLeave: actions.handlePointerLeave,
    mapPointerInside: edit.mapPointerInside,
    cursor: edit.cursor,
    infraFormSubtype: edit.infraForm.subtype,
    clipboardPreviewPoints: actions.clipboardPreviewPoints,
    setFeatureGroupSel: edit.setFeatureGroupSel,
    autoroadNetworkPickMode: actions.autoroadNetworkPickMode,
    handleAutoroadNetworkDragBoxPick: actions.handleAutoroadNetworkDragBoxPick,
    autoroadNetworkTerminalIds: actions.autoroadNetworkTerminalIds,
    featureGroupSel: edit.featureGroupSel,
    handleGeometryChange: actions.handleGeometryChange,
    handleBatchGeometryChange: actions.handleBatchGeometryChange,
    footprintEdgeHighlight: actions.footprintEdgeHighlight,
    handleMapBboxChange: data.handleMapBboxChange,
    lineDraft: actions.lineDraft,
    lineDraftPreview: actions.lineDraftPreview,
    autoroadPlanPreviewLines: actions.autoroadPlanPreviewLines,
    rulerPoints: actions.rulerPoints,
    rulerPreview: actions.rulerPreview,
    rulerCompleted: actions.rulerCompleted,
    measureCursorLabel: actions.measureCursorLabel,
    measureAnchorLabels: actions.measureAnchorLabels,
    handleFitMapView: data.handleFitMapView,
    lineLodScaleThreshold: layerPrefs.lineLodScaleThreshold,
    onViewStateSnapshot: (s) => {
      shell.last2dViewRef.current = s;
    },
    onViewChange: ({ scaleLabel, scaleDenominator }) => {
      shell.setMapScaleLabel(scaleLabel);
      shell.setMapScaleDenominator(scaleDenominator);
    },
  };
}
