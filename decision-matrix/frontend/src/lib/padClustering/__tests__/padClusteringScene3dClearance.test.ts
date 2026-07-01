import { describe, expect, it } from 'vitest';
import type { ClearancePair, WellTrajectory } from '../../api/wellTrajectoryApi';
import {
  closestApproachBetweenTrajectories,
  closestPointsOnSegments,
  collectClearancePairApproaches,
} from '../padClusteringScene3dClearance';

describe('padClusteringScene3dClearance', () => {
  it('closestPointsOnSegments finds nearest points on parallel segments', () => {
    const hit = closestPointsOnSegments(
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      { x: 0, y: 5, z: 0 },
      { x: 10, y: 5, z: 0 },
    );
    expect(hit.distSq).toBeCloseTo(25, 5);
    expect(hit.p1.y).toBeCloseTo(0, 5);
    expect(hit.p2.y).toBeCloseTo(5, 5);
  });

  it('closestApproachBetweenTrajectories uses survey stations', () => {
    const wellA: WellTrajectory = {
      well_index: 0,
      survey: {
        stations: [
          { e: 0, n: 0, tvd: 0 },
          { e: 0, n: 0, tvd: 100 },
        ],
      },
    };
    const wellB: WellTrajectory = {
      well_index: 1,
      survey: {
        stations: [
          { e: 10, n: 0, tvd: 0 },
          { e: 10, n: 0, tvd: 100 },
        ],
      },
    };
    const hit = closestApproachBetweenTrajectories(wellA, wellB, 50);
    expect(hit).not.toBeNull();
    expect(hit!.pointA.x).toBeCloseTo(0, 3);
    expect(hit!.pointB.x).toBeCloseTo(-10, 3);
  });

  it('collectClearancePairApproaches keeps warning pairs only by default', () => {
    const trajectories: WellTrajectory[] = [
      {
        well_index: 0,
        survey: { stations: [{ e: 0, n: 0, tvd: 0 }, { e: 0, n: 0, tvd: 50 }] },
      },
      {
        well_index: 1,
        survey: { stations: [{ e: 8, n: 0, tvd: 0 }, { e: 8, n: 0, tvd: 50 }] },
      },
    ];
    const pairs: ClearancePair[] = [
      { well_a: 0, well_b: 1, min_sf: 0.82, warning: true },
      { well_a: 0, well_b: 1, min_sf: 1.4, warning: false },
    ];
    expect(collectClearancePairApproaches(trajectories, pairs, 50)).toHaveLength(1);
    expect(collectClearancePairApproaches(trajectories, pairs, 50, { warningsOnly: false })).toHaveLength(
      2,
    );
  });
});
