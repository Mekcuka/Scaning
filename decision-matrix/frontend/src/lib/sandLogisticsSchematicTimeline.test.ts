import { describe, expect, it } from 'vitest';
import {
  collectSubnetEntryMarkers,
  datePositionPct,
  layoutYearMarkers,
  yearsInHorizon,
  yearIndexInHorizon,
} from './sandLogisticsSchematicTimeline';

describe('sandLogisticsSchematicTimeline', () => {
  it('collectSubnetEntryMarkers sorts quarries and consumers', () => {
    const markers = collectSubnetEntryMarkers({
      subnet_index: 1,
      name: 'S1',
      autoroad_edge_count: 0,
      quarry_count: 1,
      consumer_count: 1,
      network_nodes: [],
      network_edges: [],
      quarries: [
        {
          object_id: 'q1',
          name: 'Q',
          lon: 0,
          lat: 0,
          entry_date: '2025-01-01',
          in_service: true,
          initial_m3: 100,
          current_m3: 100,
          greedy_allocated_m3: 0,
          greedy_remaining_m3: 100,
          proportional_allocated_m3: 0,
          proportional_exceeds_capacity: false,
        },
      ],
      consumers: [
        {
          object_id: 'c1',
          name: 'C',
          subtype: 'oil_pad',
          lon: 0,
          lat: 0,
          demand_m3: 50,
          entry_date: '2024-06-01',
          in_service: true,
          nearest_quarry_id: null,
          nearest_quarry_name: null,
          distance_km: null,
          snap_to_node_km: null,
          greedy_quarry_id: null,
          greedy_quarry_name: null,
          greedy_allocated_m3: 0,
          proportional_allocations: [],
        },
      ],
      warnings: [],
    });
    expect(markers).toHaveLength(2);
    expect(markers[0]?.kind).toBe('consumer');
    expect(markers[0]?.year).toBe(2024);
  });

  it('yearsInHorizon returns inclusive range', () => {
    expect(yearsInHorizon('2024-03-01', '2026-12-31')).toEqual([2024, 2025, 2026]);
  });

  it('datePositionPct maps within horizon', () => {
    expect(datePositionPct('2024-01-01', '2024-01-01', '2026-12-31')).toBe(0);
    expect(datePositionPct('2026-12-31', '2024-01-01', '2026-12-31')).toBe(100);
  });

  it('yearIndexInHorizon finds view year', () => {
    const years = [2024, 2025, 2026];
    expect(yearIndexInHorizon('2025-12-31', years)).toBe(1);
  });

  it('layoutYearMarkers caps visible markers per year', () => {
    const markers = Array.from({ length: 12 }, (_, i) => ({
      objectId: `o${i}`,
      name: `Obj ${i}`,
      kind: 'consumer' as const,
      entryDate: '2020-06-01',
      year: 2020,
    }));
    const layout = layoutYearMarkers(markers, 4);
    expect(layout.visible).toHaveLength(4);
    expect(layout.overflowCount).toBe(8);
  });
});
