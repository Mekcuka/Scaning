import type { WellTrajectory } from '../api/wellTrajectoryApi';

export type PadClusteringWorkflowStepId = 'layout' | 'pad' | 'bottomholes' | 'trajectory';

export type PadClusteringWorkflowStep = {
  id: PadClusteringWorkflowStepId;
  label: string;
  shortLabel: string;
  done: boolean;
  active: boolean;
};

export function padClusteringWorkflowSteps(input: {
  wellsLocalCount: number;
  isDraftDirty: boolean;
  bottomholesCount: number;
  trajectories: WellTrajectory[];
}): PadClusteringWorkflowStep[] {
  const designedCount = input.trajectories.filter(
    (t) => (t.survey?.stations?.length ?? 0) >= 2,
  ).length;
  const hasLayout = input.wellsLocalCount > 0;
  const padReady = hasLayout && !input.isDraftDirty;
  const hasBottomholes = input.bottomholesCount > 0;
  const hasTrajectories = designedCount > 0;

  const steps: Omit<PadClusteringWorkflowStep, 'active'>[] = [
    { id: 'layout', label: 'Раскладка устьев', shortLabel: 'Устья', done: hasLayout },
    { id: 'pad', label: 'Площадка и KB', shortLabel: 'KB', done: padReady },
    { id: 'bottomholes', label: 'Забои на карте', shortLabel: 'Забои', done: hasBottomholes },
    { id: 'trajectory', label: 'Траектории', shortLabel: '3D', done: hasTrajectories },
  ];

  let activeAssigned = false;
  return steps.map((step) => {
    if (step.done || activeAssigned) {
      return { ...step, active: false };
    }
    activeAssigned = true;
    return { ...step, active: true };
  });
}

export function countDesignedTrajectories(trajectories: WellTrajectory[]): number {
  return trajectories.filter((t) => (t.survey?.stations?.length ?? 0) >= 2).length;
}
