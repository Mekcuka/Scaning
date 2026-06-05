import { useAppStore } from '../../store';
import type { MapViewRefs } from './mapViewRefs';
import type { MapViewProps } from './types';
import { useMapViewDataSync } from './useMapViewDataSync';
import { useMapViewInteractionState } from './useMapViewInteractionState';
import { useMapViewOverlays } from './useMapViewOverlays';
import { useMapViewSelectionSync } from './useMapViewSelectionSync';
import { useMapViewViewState } from './useMapViewViewState';

export function useMapViewReactiveEffects(refs: MapViewRefs, props: MapViewProps): void {
  const projectId = useAppStore((s) => s.currentProjectId);

  useMapViewViewState(refs, {
    projectId,
    viewStateId: props.viewStateId,
    viewStateScope: props.viewStateScope,
    persistViewState: props.persistViewState,
    showBasemap: props.showBasemap,
  });
  useMapViewInteractionState(refs, props);
  useMapViewSelectionSync(refs, props);
  useMapViewDataSync(refs, props);
  useMapViewOverlays(refs, props);
}
