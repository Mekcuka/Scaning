import { describe, expect, it } from 'vitest';
import type { SandLogisticsConsumerRow } from '../api';
import {
  buildHaulLegRows,
  findSandLogisticsConsumer,
  haulLegSummaryLabel,
} from '../sandLogisticsHaulLegs';
import type { SandLogisticsResult } from '../api';

const consumer: SandLogisticsConsumerRow = {
  object_id: 'c1',
  name: 'Куст 1',
  subtype: 'oil_pad',
  lon: 0,
  lat: 0,
  demand_m3: 100,
  entry_date: '2024-01-01',
  in_service: true,
  nearest_quarry_id: 'q1',
  nearest_quarry_name: 'Q1',
  distance_km: 5,
  snap_to_node_km: 0.1,
  greedy_quarry_id: 'q1',
  greedy_quarry_name: 'Q1',
  greedy_allocated_m3: 80,
  proportional_allocations: [
    { quarry_id: 'q2', quarry_name: 'Дальний', allocated_m3: 30, distance_km: 20 },
    { quarry_id: 'q1', quarry_name: 'Ближний', allocated_m3: 70, distance_km: 5 },
    { quarry_id: 'q3', quarry_name: 'Пустой', allocated_m3: 0, distance_km: 3 },
  ],
};

describe('buildHaulLegRows', () => {
  it('filters zero volume and sorts by distance', () => {
    const rows = buildHaulLegRows(consumer);
    expect(rows).toHaveLength(2);
    expect(rows[0].quarry_name).toBe('Ближний');
    expect(rows[1].quarry_name).toBe('Дальний');
    expect(rows[0].allocated_m3).toBe(70);
  });

  it('falls back to distances_to_quarries_km', () => {
    const c: SandLogisticsConsumerRow = {
      ...consumer,
      proportional_allocations: [
        { quarry_id: 'q9', quarry_name: 'X', allocated_m3: 10, distance_km: null },
      ],
      distances_to_quarries_km: { q9: 12.5 },
    };
    expect(buildHaulLegRows(c)[0].distance_km).toBe(12.5);
  });
});

describe('haulLegSummaryLabel', () => {
  it('formats quarry count and distance range', () => {
    const rows = buildHaulLegRows(consumer);
    expect(haulLegSummaryLabel(rows)).toBe('2 карьера, 5–20 км');
  });
});

describe('findSandLogisticsConsumer', () => {
  it('finds consumer across subnets', () => {
    const result = {
      project_id: 'p1',
      horizon_from: '2024-01-01',
      horizon_to: '2024-12-31',
      as_of: '2024-06-01',
      network_id: 'n1',
      subnet_count: 1,
      subnets: [
        {
          subnet_index: 1,
          name: 'S1',
          autoroad_edge_count: 1,
          quarry_count: 1,
          consumer_count: 1,
          network_nodes: [],
          network_edges: [],
          quarries: [],
          consumers: [consumer],
          warnings: [],
        },
      ],
      timeline: [],
      warnings: [],
      object_names: {},
    } satisfies SandLogisticsResult;
    expect(findSandLogisticsConsumer(result, 'c1')?.name).toBe('Куст 1');
    expect(findSandLogisticsConsumer(result, 'missing')).toBeNull();
  });
});
