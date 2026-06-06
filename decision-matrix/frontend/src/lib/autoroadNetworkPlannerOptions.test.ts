import { describe, expect, it, beforeEach } from 'vitest';
import {
  DEFAULT_AUTOROAD_PLANNER_OPTIONS,
  loadAutoroadPlannerOptions,
  plannerOptionsToRequestOptions,
  saveAutoroadPlannerOptions,
  terminalRoleForIndex,
} from './autoroadNetworkPlannerOptions';

describe('autoroadNetworkPlannerOptions', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips localStorage per project', () => {
    const custom = { ...DEFAULT_AUTOROAD_PLANNER_OPTIONS, connector_max_km: 0.35, solver: 'steinerpy' as const };
    saveAutoroadPlannerOptions('proj-1', custom);
    expect(loadAutoroadPlannerOptions('proj-1').connector_max_km).toBe(0.35);
    expect(loadAutoroadPlannerOptions('proj-1').solver).toBe('steinerpy');
    expect(loadAutoroadPlannerOptions('proj-2').connector_max_km).toBe(1);
  });

  it('maps to request options', () => {
    const req = plannerOptionsToRequestOptions(DEFAULT_AUTOROAD_PLANNER_OPTIONS);
    expect(req.solver).toBe('geosteiner');
    expect(req.steiner_radius_km).toBe(1);
    expect(req.max_terminals).toBe(50);
  });

  it('assigns terminal roles by index', () => {
    expect(terminalRoleForIndex(0, 3)).toBe('start');
    expect(terminalRoleForIndex(1, 3)).toBe('intermediate');
    expect(terminalRoleForIndex(2, 3)).toBe('end');
  });
});
