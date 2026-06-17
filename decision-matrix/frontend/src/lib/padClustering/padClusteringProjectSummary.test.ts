import { describe, expect, it } from 'vitest';

import { makeInfraPoint } from '../../test/fixtures/infra';
import {
  buildProjectPadClusteringSummary,
  padHasClusteringWells,
} from './padClusteringProjectSummary';

describe('padClusteringProjectSummary', () => {
  it('padHasClusteringWells detects bottomholes, uстья and trajectories', () => {
    const pad = makeInfraPoint({ id: 'pad-1', subtype: 'oil_pad', name: 'Куст 1' });
    const bottomhole = makeInfraPoint({
      id: 'bh-1',
      subtype: 'well_bottomhole_nnb',
      name: 'BH1',
      properties: { well_bottomhole_linked_pad_id: 'pad-1', well_bottomhole_well_index: 0 },
    });
    expect(padHasClusteringWells(pad, [pad], null, null)).toBe(false);
    expect(padHasClusteringWells(pad, [pad, bottomhole], null, null)).toBe(true);
    expect(
      padHasClusteringWells(
        pad,
        [pad],
        { params: null, result: null, wells_local: [{ east_m: 0, north_m: 0 }] },
        null,
      ),
    ).toBe(true);
    expect(
      padHasClusteringWells(pad, [pad], null, {
        trajectories: [{ well_index: 0, survey: { stations: [{ md: 0, tvd: 0 }] } }],
        wells_local: [],
        computed_at: null,
        settings: {},
        warnings: [],
      }),
    ).toBe(true);
  });

  it('buildProjectPadClusteringSummary aggregates multiple pads', () => {
    const pad1 = makeInfraPoint({
      id: 'pad-1',
      subtype: 'oil_pad',
      name: 'Куст 1',
      properties: { pad_reference_elevation_m: 100, pad_height_m: 1 },
    });
    const pad2 = makeInfraPoint({
      id: 'pad-2',
      subtype: 'oil_pad',
      name: 'Куст 2',
      properties: { pad_reference_elevation_m: 200, pad_height_m: 2 },
    });
    const bh1 = makeInfraPoint({
      id: 'bh-1',
      subtype: 'well_bottomhole_nnb',
      name: 'W1',
      properties: {
        well_bottomhole_linked_pad_id: 'pad-1',
        well_bottomhole_well_index: 0,
        well_bottomhole_role: 'main',
      },
    });
    const bh2 = makeInfraPoint({
      id: 'bh-2',
      subtype: 'well_bottomhole_nnb',
      name: 'W2',
      properties: {
        well_bottomhole_linked_pad_id: 'pad-2',
        well_bottomhole_well_index: 0,
        well_bottomhole_role: 'main',
      },
    });
    const infra = [pad1, pad2, bh1, bh2];
    const summary = buildProjectPadClusteringSummary({
      pads: [pad1, pad2],
      infraObjects: infra,
      earthworkByPadId: new Map([
        ['pad-1', { params: null, result: null, wells_local: [{ east_m: 0, north_m: 0 }] }],
        ['pad-2', null],
      ]),
      trajectoryByPadId: new Map([
        [
          'pad-1',
          {
            trajectories: [{ well_index: 0, survey: { stations: [{ md: 0, tvd: 0 }, { md: 100, tvd: 90 }] } }],
            wells_local: [],
            computed_at: '2026-01-01T00:00:00Z',
            settings: {},
            warnings: [],
          },
        ],
        ['pad-2', null],
      ]),
    });

    expect(summary.padsWithWellsCount).toBe(2);
    expect(summary.padTable.rows).toHaveLength(2);
    expect(summary.padTable.rows.map((row) => row.label)).toEqual(['Куст 1', 'Куст 2']);
    expect(summary.bottomholeTable.rows).toHaveLength(2);
    expect(summary.bottomholeTable.paramLabels).toContain('Куст');
    expect(summary.bottomholeTable.rows[0]?.values['Куст']).toBe('Куст 1');
    expect(summary.bottomholeTable.rows[1]?.values['Куст']).toBe('Куст 2');
  });
});
