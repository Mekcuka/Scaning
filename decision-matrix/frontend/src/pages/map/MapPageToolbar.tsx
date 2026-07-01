import { MapPoiSelect } from '../../components/MapPoiSelect';
import { MapPageToolbarCalculationsGroup } from './mapPageToolbar/MapPageToolbarCalculationsGroup';
import { MapPageToolbarDrawGroup } from './mapPageToolbar/MapPageToolbarDrawGroup';
import { MapPageToolbarEditGroup } from './mapPageToolbar/MapPageToolbarEditGroup';
import { MapPageToolbarViewGroup } from './mapPageToolbar/MapPageToolbarViewGroup';
import type { MapPageToolbarProps } from './mapPageToolbar/types';

export type { MapPageToolbarProps } from './mapPageToolbar/types';

export function MapPageToolbar(props: MapPageToolbarProps) {
  const {
    map3dFeatureEnabled,
    mapDisplayMode,
    onDisplayModeChange,
    mapLayersOpen,
    onToggleLayers,
    mapFullscreen,
    onToggleFullscreen,
    projectId,
    pois,
    selectedPoiId,
    onSelectedPoiIdChange,
    mapEditEnabled,
    onToggleMapEdit,
    canEditMap,
    mapIn3d,
    canUndo,
    onUndo,
    canCopy,
    onCopy,
    canPaste,
    onPaste,
    canCut,
    onCut,
    canDelete,
    selectedOnMapCount,
    deletePending,
    onDelete,
    drawMode,
    onDrawModeChange,
    selectMode,
    onSelectModeChange,
    onResetDrawingMenus,
    canWriteInfra,
    canWriteProject,
    projectJobBusy,
    infraFormSubtype,
    onInfraFormSubtypeChange,
    pointMenuOpen,
    onPointMenuOpenChange,
    lineMenuOpen,
    onLineMenuOpenChange,
    bottomholeMenuOpen,
    onBottomholeMenuOpenChange,
    onClearLineDraft,
    onClearRuler,
    poisCount,
    selectedPoiName,
    analyzePending,
    onAnalyzeAll,
    onAnalyzeSelected,
    lineProfileComputePending,
    onLineProfileCompute,
  } = props;

  return (
    <div className="map-tools">
      <MapPageToolbarViewGroup
        map3dFeatureEnabled={map3dFeatureEnabled}
        mapDisplayMode={mapDisplayMode}
        onDisplayModeChange={onDisplayModeChange}
        mapLayersOpen={mapLayersOpen}
        onToggleLayers={onToggleLayers}
        mapFullscreen={mapFullscreen}
        onToggleFullscreen={onToggleFullscreen}
      />
      <MapPageToolbarEditGroup
        mapEditEnabled={mapEditEnabled}
        onToggleMapEdit={onToggleMapEdit}
        canEditMap={canEditMap}
        mapIn3d={mapIn3d}
        canUndo={canUndo}
        onUndo={onUndo}
        canCopy={canCopy}
        onCopy={onCopy}
        canPaste={canPaste}
        onPaste={onPaste}
        canCut={canCut}
        onCut={onCut}
        canDelete={canDelete}
        selectedOnMapCount={selectedOnMapCount}
        deletePending={deletePending}
        onDelete={onDelete}
      />
      <MapPageToolbarCalculationsGroup
        projectId={projectId}
        poisCount={poisCount}
        selectedPoiId={selectedPoiId}
        selectedPoiName={selectedPoiName}
        canWriteProject={canWriteProject}
        canWriteInfra={canWriteInfra}
        analyzePending={analyzePending}
        onAnalyzeAll={onAnalyzeAll}
        onAnalyzeSelected={onAnalyzeSelected}
        drawMode={drawMode}
        onDrawModeChange={onDrawModeChange}
        onResetDrawingMenus={onResetDrawingMenus}
        projectJobBusy={projectJobBusy}
        mapIn3d={mapIn3d}
        lineProfileComputePending={lineProfileComputePending}
        onLineProfileCompute={onLineProfileCompute}
      />
      <MapPageToolbarDrawGroup
        drawMode={drawMode}
        onDrawModeChange={onDrawModeChange}
        selectMode={selectMode}
        onSelectModeChange={onSelectModeChange}
        onResetDrawingMenus={onResetDrawingMenus}
        canWriteInfra={canWriteInfra}
        canWriteProject={canWriteProject}
        mapIn3d={mapIn3d}
        infraFormSubtype={infraFormSubtype}
        onInfraFormSubtypeChange={onInfraFormSubtypeChange}
        pointMenuOpen={pointMenuOpen}
        onPointMenuOpenChange={onPointMenuOpenChange}
        lineMenuOpen={lineMenuOpen}
        onLineMenuOpenChange={onLineMenuOpenChange}
        bottomholeMenuOpen={bottomholeMenuOpen}
        onBottomholeMenuOpenChange={onBottomholeMenuOpenChange}
        onClearLineDraft={onClearLineDraft}
        onClearRuler={onClearRuler}
      />
      {projectId && pois.length > 0 ? (
        <>
          <span className="map-tools-sep map-tools-sep--poi" aria-hidden />
          <div className="map-tools-group map-tools-group--poi">
            <span className="map-tools-group--poi__label">POI</span>
            <MapPoiSelect
              pois={pois}
              value={selectedPoiId ?? pois[0].id}
              onChange={onSelectedPoiIdChange}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
