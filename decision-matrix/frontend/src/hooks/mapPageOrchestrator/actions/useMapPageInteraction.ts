import { useCallback } from 'react';
import { emptyPoiFormValues, nextPoiAutoName } from '../../../lib/poiParams';
import { formatCoord } from '../../../lib/coords';
import type { MapClickHit } from '../../../components/MapView';
import { useMapHotkeys } from '../../../lib/mapHotkeys';
import { useAppStore } from '../../../store';
import { submitPoiCreate } from '../submitPoi';
import type { MapPageActionsParams } from '../mapPageActionsTypes';
import type { useMapAutoroadActions } from './useMapAutoroadActions';
import type { useMapPadPlacementActions } from './useMapPadPlacementActions';
import type { useMapDrawAndCreateActions } from './useMapDrawAndCreateActions';
import type { useMapSelectionActions } from './useMapSelectionActions';
import type { useLineFootprintEdgePick } from '../../useLineFootprintEdgePick';
import type { useBottomholeDraw } from '../../useBottomholeDraw';

type AutoroadActions = ReturnType<typeof useMapAutoroadActions>;
type PadPlacementActions = ReturnType<typeof useMapPadPlacementActions>;
type DrawActions = ReturnType<typeof useMapDrawAndCreateActions>;
type SelectionActions = ReturnType<typeof useMapSelectionActions>;
type LineFootprintEdgePick = ReturnType<typeof useLineFootprintEdgePick>;
type BottomholeDraw = ReturnType<typeof useBottomholeDraw>;

export function useMapPageInteraction(
  params: MapPageActionsParams,
  slices: {
    autoroad: AutoroadActions;
    padPlacement: PadPlacementActions;
    draw: DrawActions;
    selection: SelectionActions;
    lineFootprintEdgePick: LineFootprintEdgePick;
    bottomholeDraw: BottomholeDraw;
  },
) {
  const { projectId, canWriteProject, canWriteInfra, canEditMap, edit } = params;
  const { autoroad, padPlacement, draw, selection, lineFootprintEdgePick, bottomholeDraw } = slices;
  const { pois } = params.data;
  const pushToast = useAppStore((s) => s.pushToast);
  const { cursorRef } = edit;

  const needsCursorState =
    edit.pasteMode ||
    edit.drawMode === 'point' ||
    edit.drawMode === 'poi' ||
    edit.drawMode === 'bottomhole_nnb' ||
    edit.drawMode === 'bottomhole_gs';
  const needsCursorStateWithDrawing = needsCursorState || draw.needsDrawCursor;

  const handleMapEscape = useCallback(() => {
    if (edit.pasteMode) {
      edit.setPasteMode(false);
      return;
    }
    if (selection.deleteConfirm) {
      selection.setDeleteConfirm(null);
      return;
    }
    if (edit.modal) {
      edit.setModal(null);
      return;
    }
    if (edit.candidateSubtype) {
      edit.setCandidateSubtype(null);
      edit.setCandidateParamType('external');
      return;
    }
    if (edit.searchOpen) {
      edit.setSearchOpen(false);
      return;
    }
    if (bottomholeDraw.isBottomholeDrawActive) {
      bottomholeDraw.cancelBottomholeDraw();
      edit.setDrawMode('select');
      edit.setBottomholeMenuOpen(false);
      return;
    }
    const drawingActive =
      edit.drawMode !== 'select' || edit.pointMenuOpen || edit.lineMenuOpen;
    if (drawingActive) {
      edit.cancelDrawingSelection();
    }
  }, [edit, selection, bottomholeDraw]);

  const handlePointerMove = useCallback(
    (lon: number, lat: number, overPoint?: { lon: number; lat: number }) => {
      edit.setMapPointerInside(true);
      cursorRef.current = { lon, lat };
      if (needsCursorStateWithDrawing) {
        edit.setCursor((prev) =>
          prev && prev.lon === lon && prev.lat === lat ? prev : { lon, lat },
        );
      }
      draw.updatePointerMove(lon, lat, overPoint);
      lineFootprintEdgePick.handlePointerMoveForEdgePick(lon, lat);
    },
    [needsCursorStateWithDrawing, draw, edit, cursorRef, lineFootprintEdgePick],
  );

  const handlePointerLeave = useCallback(() => {
    edit.setMapPointerInside(false);
    draw.clearDrawingPreviews();
    lineFootprintEdgePick.clearFootprintEdgeHighlight();
  }, [draw, edit, lineFootprintEdgePick]);

  const handleMapClick = useCallback(
    (lon: number, lat: number, hit?: MapClickHit) => {
      if (edit.pasteMode) {
        void selection.executePaste(lon, lat);
        return;
      }
      if (edit.drawMode === 'select' && edit.footprintLineConnectPickSubtype) {
        void lineFootprintEdgePick.handleMapClickForEdgePick(lon, lat);
        return;
      }
      if (edit.drawMode === 'bottomhole_nnb' || edit.drawMode === 'bottomhole_gs') {
        if (!canWriteInfra) return;
        void bottomholeDraw.handleMapClickForBottomholeDraw(lon, lat);
        return;
      }
      if (edit.drawMode === 'autoroad_network') {
        autoroad.handleMapClick(hit);
        return;
      }
      if (edit.drawMode === 'pad_placement') {
        padPlacement.handlePadPlacementMapClick(lon, lat, hit);
        return;
      }
      if (edit.drawMode === 'ruler') {
        draw.handleRulerClick(lon, lat);
        return;
      }
      if (edit.drawMode === 'poi') {
        if (!canWriteProject) return;
        edit.setPoiForm(
          emptyPoiFormValues({
            name: nextPoiAutoName(pois),
            lon: formatCoord(lon),
            lat: formatCoord(lat),
          }),
        );
        edit.setModal({ type: 'poi', lon, lat });
        return;
      }
      if (edit.drawMode === 'point') {
        if (!canWriteInfra) return;
        if (!projectId) return;
        const subtype = edit.infraForm.subtype;
        void draw.placeInfraPointAt(
          subtype,
          lon,
          lat,
          hit?.overLine
            ? {
                lineId: hit.overLine.lineId,
                segmentIndex: hit.overLine.segmentIndex,
                snapLon: hit.overLine.lon,
                snapLat: hit.overLine.lat,
              }
            : undefined,
        );
        return;
      }
      if (edit.drawMode === 'line') {
        draw.handleLineClick(lon, lat, hit);
      }
    },
    [
      edit,
      selection,
      autoroad,
      padPlacement,
      draw,
      canWriteProject,
      canWriteInfra,
      pois,
      projectId,
      lineFootprintEdgePick,
      bottomholeDraw,
    ],
  );

  useMapHotkeys({
    drawMode: edit.drawMode,
    canDelete:
      selection.canDeleteCurrentSelection &&
      selection.selectedOnMapCount > 0 &&
      !selection.deleteConfirm &&
      !edit.modal &&
      !selection.deleteGroupMut.isPending &&
      !selection.deleteInfraMut.isPending,
    canToggleEdit: canEditMap,
    canCopy: selection.canCopyMapSelection && !selection.deleteConfirm && !edit.modal,
    canPaste: selection.canPasteMapClipboard && !selection.deleteConfirm && !edit.modal,
    canCut: selection.canCutMapSelection && !selection.deleteConfirm && !edit.modal,
    onEscape: handleMapEscape,
    onDelete: selection.requestDeleteSelection,
    onCopy: selection.copyMapSelection,
    onPaste: selection.enterPasteMode,
    onCut: selection.cutMapSelection,
    onToggleEdit: () => edit.setMapEditEnabled((on) => !on),
    onFinishLine:
      edit.drawMode === 'line'
        ? () => void draw.finishLineDraft(draw.lineDraft, draw.lineDraftFinishAt())
        : undefined,
  });

  const resetDrawingMenusForToolbar = useCallback(() => {
    draw.resetDrawingMenus();
    edit.setPointMenuOpen(false);
    edit.setLineMenuOpen(false);
  }, [draw, edit]);

  const submitPoi = () =>
    submitPoiCreate({
      projectId,
      modal: edit.modal,
      poiForm: edit.poiForm,
      pois,
      pushToast,
      createPoiMut: draw.createPoiMut,
    });

  return {
    handlePointerMove,
    handlePointerLeave,
    handleMapClick,
    resetDrawingMenusForToolbar,
    submitPoi,
  };
}
