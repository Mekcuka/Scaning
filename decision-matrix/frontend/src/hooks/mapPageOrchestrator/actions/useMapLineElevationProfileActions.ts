import { useLineElevationProfileCompute } from '../../useLineElevationProfileCompute';
import type { MapPageActionsParams } from '../mapPageActionsTypes';

export function useMapLineElevationProfileActions(params: MapPageActionsParams) {
  const { projectId } = params;
  const { compute, computePending } = useLineElevationProfileCompute(projectId ?? undefined);

  return {
    computeLineProfile: compute,
    lineProfileComputePending: computePending,
  };
}
