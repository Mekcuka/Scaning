import { describe, expect, it } from 'vitest';
import { countDesignedTrajectories, padClusteringWorkflowSteps } from './padClusteringWorkflow';

describe('padClusteringWorkflowSteps', () => {
  it('marks layout done when wells exist', () => {
    const steps = padClusteringWorkflowSteps({
      wellsLocalCount: 12,
      isDraftDirty: false,
      bottomholesCount: 0,
      trajectories: [],
    });
    expect(steps.find((s) => s.id === 'layout')?.done).toBe(true);
  });

  it('marks pad step incomplete when draft is dirty', () => {
    const steps = padClusteringWorkflowSteps({
      wellsLocalCount: 12,
      isDraftDirty: true,
      bottomholesCount: 0,
      trajectories: [],
    });
    expect(steps.find((s) => s.id === 'pad')?.done).toBe(false);
  });

  it('highlights first incomplete step as active', () => {
    const steps = padClusteringWorkflowSteps({
      wellsLocalCount: 12,
      isDraftDirty: true,
      bottomholesCount: 0,
      trajectories: [],
    });
    expect(steps.filter((s) => s.active)).toHaveLength(1);
    expect(steps.find((s) => s.active)?.id).toBe('pad');
  });
});

describe('countDesignedTrajectories', () => {
  it('counts wells with at least 2 stations', () => {
    expect(
      countDesignedTrajectories([
        { well_index: 0, survey: { stations: [{}, {}] } },
        { well_index: 1, survey: { stations: [{}] } },
      ]),
    ).toBe(1);
  });
});
