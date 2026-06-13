import type { WellTrajectory } from './api/wellTrajectoryApi';
import type { PlanVertex } from './padEarthworkSketch';
import { trajectoriesAlignWithWells } from './padClusteringScene3d';

export type PadClusteringSceneTrajectoryDisplay = {
  sceneTrajectories: WellTrajectory[];
  sceneWellsLocal: PlanVertex[];
  sceneTrajectoriesHidden: boolean;
};

/** Resolve which trajectories / wellheads the 3D scene should render. */
export function resolvePadClusteringSceneTrajectoryDisplay(input: {
  trajectories: WellTrajectory[];
  persistedWellsLocal: PlanVertex[];
  activeWellsLocal: PlanVertex[];
}): PadClusteringSceneTrajectoryDisplay {
  const { trajectories, persistedWellsLocal, activeWellsLocal } = input;

  if (trajectories.length === 0) {
    return {
      sceneTrajectories: [],
      sceneWellsLocal: activeWellsLocal,
      sceneTrajectoriesHidden: false,
    };
  }

  const alignedWithPersisted = trajectoriesAlignWithWells(trajectories, persistedWellsLocal);
  const alignedWithActive = trajectoriesAlignWithWells(trajectories, activeWellsLocal);

  if (alignedWithActive) {
    return {
      sceneTrajectories: trajectories,
      sceneWellsLocal: activeWellsLocal,
      sceneTrajectoriesHidden: false,
    };
  }

  if (alignedWithPersisted) {
    return {
      sceneTrajectories: trajectories,
      sceneWellsLocal: persistedWellsLocal,
      sceneTrajectoriesHidden: false,
    };
  }

  return {
    sceneTrajectories: [],
    sceneWellsLocal: activeWellsLocal,
    sceneTrajectoriesHidden: true,
  };
}

/** Stable revision key for 3D scene rebuild when survey content changes. */
export function trajectoriesSceneRevision(trajectories: WellTrajectory[]): string {
  return trajectories
    .map((t) => {
      const stations = t.survey?.stations ?? [];
      const last = stations[stations.length - 1];
      return [
        t.well_index,
        stations.length,
        last?.md ?? 0,
        last?.tvd ?? 0,
        t.survey?.source ?? '',
        t.clearance?.min_sf ?? '',
      ].join(':');
    })
    .join('|');
}
