import { useAppStore } from '../../store';
import type { MapViewRefs } from './mapViewRefs';
import type { MapViewProps } from './types';
import { useMapViewDataSync } from './useMapViewDataSync';
import { useMapViewInteractionState } from './useMapViewInteractionState';
import { useMapViewOverlays } from './useMapViewOverlays';
import { useMapViewSelectionSync } from './useMapViewSelectionSync';
import { useMapViewViewState } from './useMapViewViewState';

import { useMapViewWellTrajectorySync } from './useMapViewWellTrajectorySync';
import { useMapViewPadPlacementSync } from './useMapViewPadPlacementSync';
import { useMapViewEmphasisSync } from './useMapViewEmphasisSync';

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
  useMapViewEmphasisSync(refs, props);
  useMapViewDataSync(refs, props);
  useMapViewWellTrajectorySync(refs, {
    features: props.wellTrajectoryFeatures ?? [],
    showWellTrajectories: props.showWellTrajectories ?? false,
    showWellBottomholes: props.showWellBottomholes ?? false,
  });
  useMapViewPadPlacementSync(refs, props.padPlacementPreviewFeatures);
  useMapViewOverlays(refs, props);
}
