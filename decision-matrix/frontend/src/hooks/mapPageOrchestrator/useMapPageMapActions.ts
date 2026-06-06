import { useMapAnalysisActions } from './actions/useMapAnalysisActions';
import { useMapAutoroadActions } from './actions/useMapAutoroadActions';
import { useMapDisplayActions } from './actions/useMapDisplayActions';
import { useMapDrawAndCreateActions } from './actions/useMapDrawAndCreateActions';
import { useMapPageInteraction } from './actions/useMapPageInteraction';
import { useMapSelectionActions } from './actions/useMapSelectionActions';
import type { MapPageActionsParams } from './mapPageActionsTypes';

export type { MapPageActionsParams } from './mapPageActionsTypes';

export function useMapPageMapActions(params: MapPageActionsParams) {
  const { autoroadConfirmModal } = params;

  const autoroad = useMapAutoroadActions(params);
  const draw = useMapDrawAndCreateActions(params);
  const selection = useMapSelectionActions(params);
  const analysis = useMapAnalysisActions(params);
  const display = useMapDisplayActions(params);
  const interaction = useMapPageInteraction(params, { autoroad, draw, selection });
  const { needsDrawCursor: _omitNeedsDrawCursor, ...drawSlice } = draw;

  return {
    ...autoroad,
    ...drawSlice,
    ...selection,
    ...analysis,
    ...display,
    ...interaction,
    autoroadConfirmModal,
  };
}
