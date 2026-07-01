import { describe, expect, it } from 'vitest';
import type { WellTrajectory } from '../../api/wellTrajectoryApi';
import {
  resolvePadClusteringSceneTrajectoryDisplay,
  trajectoriesSceneRevision,
} from '../padClusteringSceneTrajectories';

const wells2 = [
  { east_m: 0, north_m: 0 },
  { east_m: 9, north_m: 0 },
];

const wells12Preview = Array.from({ length: 12 }, (_, i) => ({
  east_m: i * 9,
  north_m: 0,
}));

function trajAt(wellIndex: number, east: number, north: number, stationCount = 2): WellTrajectory {
  return {
    well_index: wellIndex,
    survey: {
      source: 'calculated',
      stations: Array.from({ length: stationCount }, (_, i) => ({
        md: i * 100,
        tvd: i * 100,
        e: east,
        n: north,
        inc: 0,
        azi: 90,
      })),
    },
  };
}

describe('resolvePadClusteringSceneTrajectoryDisplay', () => {
  it('shows trajectories on active layout when aligned', () => {
    const trajectories = [trajAt(0, 0, 0), trajAt(1, 9, 0)];
    const result = resolvePadClusteringSceneTrajectoryDisplay({
      trajectories,
      persistedWellsLocal: wells2,
      activeWellsLocal: wells2,
    });
    expect(result.sceneTrajectories).toHaveLength(2);
    expect(result.sceneWellsLocal).toBe(wells2);
    expect(result.sceneTrajectoriesHidden).toBe(false);
  });

  it('shows persisted trajectories during layout preview when preview wells diverge', () => {
    const trajectories = [trajAt(0, 0, 0, 24), trajAt(1, 9, 0, 24)];
    const result = resolvePadClusteringSceneTrajectoryDisplay({
      trajectories,
      persistedWellsLocal: wells2,
      activeWellsLocal: wells12Preview,
    });
    expect(result.sceneTrajectories).toHaveLength(2);
    expect(result.sceneWellsLocal).toBe(wells2);
    expect(result.sceneTrajectoriesHidden).toBe(false);
  });

  it('hides trajectories when neither layout matches', () => {
    const trajectories = [trajAt(0, 50, 50), trajAt(1, 59, 50)];
    const result = resolvePadClusteringSceneTrajectoryDisplay({
      trajectories,
      persistedWellsLocal: wells2,
      activeWellsLocal: wells12Preview,
    });
    expect(result.sceneTrajectories).toHaveLength(0);
    expect(result.sceneTrajectoriesHidden).toBe(true);
  });
});

describe('trajectoriesSceneRevision', () => {
  it('changes when station count or source changes', () => {
    const stub = [trajAt(0, 0, 0, 2)];
    const designed = [trajAt(0, 0, 0, 40)];
    expect(trajectoriesSceneRevision(stub)).not.toBe(trajectoriesSceneRevision(designed));
  });
});
