import { describe, expect, it } from 'vitest';
import {
  consumerVolumeLines,
  quarryVolumeLines,
  resolveSandConsumerNodeStatus,
  shouldShowEntryDateOnNode,
} from '../sandLogisticsNodeVisual';

describe('sandLogisticsNodeVisual', () => {
  it('resolves future consumer', () => {
    expect(
      resolveSandConsumerNodeStatus({
        in_service: false,
        demand_m3: 1000,
        allocated_m3: 0,
      }),
    ).toBe('future');
  });

  it('resolves unallocated in-service consumer', () => {
    expect(
      resolveSandConsumerNodeStatus({
        in_service: true,
        demand_m3: 1000,
        allocated_m3: 0,
      }),
    ).toBe('unallocated');
  });

  it('resolves planPartialOnDate when plan exceeds effective demand', () => {
    expect(
      resolveSandConsumerNodeStatus({
        in_service: true,
        demand_m3: 500,
        allocated_m3: 500,
        demand_plan_total_m3: 1500,
      }),
    ).toBe('planPartialOnDate');
  });

  it('shows entry date for future objects', () => {
    expect(
      shouldShowEntryDateOnNode({
        kind: 'consumer',
        in_service: false,
        entry_date: '2027-06-01',
      }),
    ).toBe(true);
  });

  it('hides entry date for in-service consumer', () => {
    expect(
      shouldShowEntryDateOnNode({
        kind: 'consumer',
        in_service: true,
        entry_date: '2020-01-01',
        as_of: '2025-01-01',
      }),
    ).toBe(false);
  });

  it('future consumer volume line shows plan', () => {
    const lines = consumerVolumeLines('future', {
      demand_m3: 0,
      allocated_m3: 0,
      demand_plan_total_m3: 1000,
    });
    expect(lines[0]).toMatch(/план 1[\s\u00a0]?000 м³/);
  });

  it('unallocated consumer shows no-shipment hint', () => {
    const lines = consumerVolumeLines('unallocated', {
      demand_m3: 1000,
      allocated_m3: 0,
      demand_plan_total_m3: 1000,
    });
    expect(lines[0]).toContain('нет отгрузки');
  });

  it('active quarry shows remaining over initial as numbers only', () => {
    const lines = quarryVolumeLines('active', {
      remaining_m3: 3200,
      initial_m3: 5000,
    });
    expect(lines[0]).toMatch(/3[\s\u00a0\u202f]?200 \/ 5[\s\u00a0\u202f]?000/);
  });

  it('future quarry shows dash over initial total', () => {
    const lines = quarryVolumeLines('future', {
      remaining_m3: 5000,
      initial_m3: 5000,
    });
    expect(lines[0]).toMatch(/^— \/ 5/);
  });
});
