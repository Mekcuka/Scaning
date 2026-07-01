import { describe, expect, it } from 'vitest';
import { buildLineSplitConfirmSummary } from '../lineSplitConfirmMessages';
import type { InfraObject } from '../api';

function line(name: string): InfraObject {
  return {
    id: 'line-1',
    name,
    subtype: 'gas_pipeline',
    lon: 37.6,
    lat: 55.75,
    layer_id: 'layer-1',
    project_id: 'proj-1',
    properties: {},
  };
}

describe('buildLineSplitConfirmSummary', () => {
  it('builds summary for line finish with node', () => {
    const summary = buildLineSplitConfirmSummary({
      split: {
        line: line('Газопровод_1'),
        segmentIndex: 0,
        snapLon: 37.605,
        snapLat: 55.7525,
        distanceKm: 0.01,
      },
      pointLabel: 'Узел',
      scenario: 'line_finish',
    });

    expect(summary.lineName).toBe('Газопровод_1');
    expect(summary.lineSubtypeLabel).toBe('Газопровод');
    expect(summary.secondLineName).toBe('Газопровод_1 (2)');
    expect(summary.pointLabel).toBe('Узел');
    expect(summary.scenario).toBe('line_finish');
  });

  it('builds summary for point on line', () => {
    const summary = buildLineSplitConfirmSummary({
      split: {
        line: line('Дорога_2'),
        segmentIndex: 1,
        snapLon: 37.61,
        snapLat: 55.76,
        distanceKm: 0.02,
      },
      pointLabel: 'Узел',
      scenario: 'point_on_line',
    });

    expect(summary.scenario).toBe('point_on_line');
    expect(summary.secondLineName).toBe('Дорога_2 (2)');
  });
});
