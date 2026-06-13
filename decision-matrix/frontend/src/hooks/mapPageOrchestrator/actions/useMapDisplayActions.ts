import { useMapDisplaySwitch } from '../../useMapDisplaySwitch';
import { useMapFooterHint } from '../../useMapFooterHint';
import { useAppStore } from '../../../store';
import type { MapPageActionsParams } from '../mapPageActionsTypes';

export function useMapDisplayActions(params: MapPageActionsParams) {
  const { projectId, edit, shell, data, mapIn3d, mapInFootprints, setMapDisplayMode } = params;
  const effectiveProjectId = projectId ?? undefined;
  const pushToast = useAppStore((s) => s.pushToast);
  const { detailSelection } = data;

  const display = useMapDisplaySwitch({
    projectId: effectiveProjectId,
    drawMode: edit.drawMode,
    setDrawMode: edit.setDrawMode,
    mapIn3d,
    setMapDisplayMode,
    pushToast,
    map3dRef: shell.map3dRef,
    last2dViewRef: shell.last2dViewRef,
    onClearDrawingForModeSwitch: () => edit.clearDrawingForModeSwitchRef.current(),
    setPointMenuOpen: edit.setPointMenuOpen,
    setLineMenuOpen: edit.setLineMenuOpen,
  });

  const mapFooterHint = useMapFooterHint({
    pasteMode: edit.pasteMode,
    drawMode: edit.drawMode,
    mapEditEnabled: edit.mapEditEnabled,
    detailSelection,
    selectMode: edit.selectMode,
    featureGroupCount: edit.featureGroupSel.length,
    mapInFootprints,
  });

  return {
    ...display,
    mapFooterHint,
  };
}
