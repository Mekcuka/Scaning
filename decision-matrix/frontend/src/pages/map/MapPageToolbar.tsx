import { MapPoiSelect } from '../../components/MapPoiSelect';
import { MapPageToolbarDrawActions } from './mapPageToolbar/MapPageToolbarDrawActions';
import { MapPageToolbarDrawGroup } from './mapPageToolbar/MapPageToolbarDrawGroup';
import { MapPageToolbarEditGroup } from './mapPageToolbar/MapPageToolbarEditGroup';
import { MapPageToolbarSearch } from './mapPageToolbar/MapPageToolbarSearch';
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
    drawActionsVisible,
    drawStepBackDisabled,
    drawFinishDisabled,
    drawResetDisabled,
    onDrawStepBack,
    onDrawFinish,
    onDrawReset,
    searchQ,
    onSearchQChange,
    searchOpen,
    onSearchOpenChange,
    searchSuggestions,
    onPickSearchResult,
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
      {projectId && pois.length > 0 && (
        <div className="map-tools-group map-tools-group--poi">
          <MapPoiSelect
            pois={pois}
            value={selectedPoiId ?? pois[0].id}
            onChange={onSelectedPoiIdChange}
          />
        </div>
      )}
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
      <MapPageToolbarDrawGroup
        drawMode={drawMode}
        onDrawModeChange={onDrawModeChange}
        selectMode={selectMode}
        onSelectModeChange={onSelectModeChange}
        onResetDrawingMenus={onResetDrawingMenus}
        canWriteInfra={canWriteInfra}
        canWriteProject={canWriteProject}
        projectJobBusy={projectJobBusy}
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
      <MapPageToolbarDrawActions
        drawMode={drawMode}
        drawActionsVisible={drawActionsVisible}
        drawStepBackDisabled={drawStepBackDisabled}
        drawFinishDisabled={drawFinishDisabled}
        drawResetDisabled={drawResetDisabled}
        onDrawStepBack={onDrawStepBack}
        onDrawFinish={onDrawFinish}
        onDrawReset={onDrawReset}
      />
      {projectId && (
        <MapPageToolbarSearch
          searchQ={searchQ}
          onSearchQChange={onSearchQChange}
          searchOpen={searchOpen}
          onSearchOpenChange={onSearchOpenChange}
          searchSuggestions={searchSuggestions}
          onPickSearchResult={onPickSearchResult}
        />
      )}
    </div>
  );
}
