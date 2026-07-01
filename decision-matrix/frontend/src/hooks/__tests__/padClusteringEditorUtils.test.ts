import { describe, expect, it } from 'vitest';
import type { InfraObject } from '../../lib/api';
import {
  draftFromPadSources,
  padClusteringDraftSourceKey,
  resolvePadClusteringDraftSync,
} from '../padClusteringEditorUtils';

function samplePad(overrides: Partial<InfraObject> = {}): InfraObject {
  return {
    id: 'pad-1',
    project_id: 'proj-1',
    name: 'Куст 1',
    subtype: 'oil_pad',
    lon: 50,
    lat: 55,
    layer_id: 'layer-1',
    properties: {},
    ...overrides,
  } as InfraObject;
}

describe('draftFromPadSources', () => {
  it('aligns well count with persisted wells_local when properties are stale', () => {
    const pad = samplePad({
      properties: { pad_well_count: 12 },
    });
    const draft = draftFromPadSources({ pad, wellsCount: 6 });
    expect(draft.padWellCount).toBe('6');
  });

  it('prefers bottomhole-derived well count over pad_well_count and wells_local', () => {
    const pad = samplePad({
      properties: { pad_well_count: 12 },
    });
    const bottomholes = [
      samplePad({
        id: 'bh-1',
        subtype: 'well_bottomhole_nnb',
        properties: { well_bottomhole_linked_pad_id: pad.id, well_bottomhole_well_index: 0 },
      }),
      samplePad({
        id: 'bh-2',
        subtype: 'well_bottomhole_nnb',
        properties: { well_bottomhole_linked_pad_id: pad.id, well_bottomhole_well_index: 5 },
      }),
    ] as InfraObject[];
    const draft = draftFromPadSources({ pad, wellsCount: 12, linkedBottomholes: bottomholes });
    expect(draft.padWellCount).toBe('6');
  });

  it('prefers earthwork params for footprint fields', () => {
    const pad = samplePad({
      properties: { pad_length_m: 120, pad_width_m: 80 },
    });
    const draft = draftFromPadSources({
      pad,
      wellsCount: 4,
      earthworkParams: {
        length_m: 196,
        width_m: 58,
        height_m: 1.2,
        reference_elevation_m: 118,
        rotation_deg: 45,
      },
    });
    expect(draft).toMatchObject({
      padWellCount: '4',
      lengthM: '196',
      widthM: '58',
      heightM: '1.2',
      referenceElevationM: '118',
      rotationDeg: '45',
    });
  });
});

describe('resolvePadClusteringDraftSync', () => {
  const server = {
    padWellCount: '6',
    padWellsPerGroup: '1',
    padWellSpacingM: '9',
    padGroupSpacingM: '9',
    padMarginLeftM: '27',
    padMarginBottomM: '43',
    padMarginTopM: '15',
    padMarginEndM: '70',
    lengthM: '196',
    widthM: '58',
    heightM: '1',
    rotationDeg: '90',
    referenceElevationM: '120',
  };

  it('accepts server draft when user has no local edits', () => {
    expect(resolvePadClusteringDraftSync(server, { ...server, padWellCount: '8' }, server, false)).toEqual({
      ...server,
      padWellCount: '8',
    });
  });

  it('accepts server draft after local save matches server', () => {
    const local = { ...server, padWellCount: '8' };
    expect(resolvePadClusteringDraftSync(local, local, server, false)).toEqual(local);
  });

  it('keeps local draft when user edited since last server snapshot', () => {
    const local = { ...server, padWellCount: '10' };
    expect(resolvePadClusteringDraftSync(local, { ...server, padWellCount: '8' }, server, false)).toBe(local);
  });

  it('resets on pad change', () => {
    const local = { ...server, padWellCount: '10' };
    expect(resolvePadClusteringDraftSync(local, { ...server, padWellCount: '8' }, server, true)).toEqual({
      ...server,
      padWellCount: '8',
    });
  });
});

describe('padClusteringDraftSourceKey', () => {
  it('changes when draft fields change', () => {
    const a = padClusteringDraftSourceKey({
      padWellCount: '12',
      padWellsPerGroup: '1',
      padWellSpacingM: '9',
      padGroupSpacingM: '9',
      padMarginLeftM: '27',
      padMarginBottomM: '43',
      padMarginTopM: '15',
      padMarginEndM: '70',
      lengthM: '120',
      widthM: '80',
      heightM: '1',
      rotationDeg: '90',
      referenceElevationM: '0',
    });
    const b = padClusteringDraftSourceKey({
      padWellCount: '6',
      padWellsPerGroup: '1',
      padWellSpacingM: '9',
      padGroupSpacingM: '9',
      padMarginLeftM: '27',
      padMarginBottomM: '43',
      padMarginTopM: '15',
      padMarginEndM: '70',
      lengthM: '120',
      widthM: '80',
      heightM: '1',
      rotationDeg: '90',
      referenceElevationM: '0',
    });
    expect(a).not.toBe(b);
  });
});
