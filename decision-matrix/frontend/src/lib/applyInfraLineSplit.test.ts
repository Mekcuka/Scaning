import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InfraObject } from './api';
import { applyInfraLineSplit, resolveLineSplitCandidate } from './applyInfraLineSplit';

const line = (over: Partial<InfraObject>): InfraObject =>
  ({
    id: 'line-1',
    name: 'Дорога_1',
    subtype: 'autoroad',
    layer_id: 'layer-1',
    lon: 37.6,
    lat: 55.75,
    end_lon: 37.62,
    end_lat: 55.76,
    coordinates: [
      [37.6, 55.75],
      [37.61, 55.755],
      [37.62, 55.76],
    ],
    properties: {},
    ...over,
  }) as InfraObject;

function createSplitMocks() {
  const mapApi = {
    updateInfraObject: vi.fn(),
    createInfraObject: vi.fn(),
    deleteInfraObject: vi.fn(),
    batchDeleteMapObjects: vi.fn(),
    batchPasteMapObjects: vi.fn(),
  };
  const networkApi = { buildNetwork: vi.fn() };
  return { mapApi, networkApi };
}

describe('resolveLineSplitCandidate', () => {
  it('prefers map split hint over geometry search', () => {
    const other = line({ id: 'line-2', coordinates: [[38, 56], [38.01, 56.01]] });
    const found = resolveLineSplitCandidate(37.605, 55.7525, [line({}), other], {
      lineId: 'line-1',
      segmentIndex: 0,
      snapLon: 37.605,
      snapLat: 55.7525,
    });
    expect(found?.line.id).toBe('line-1');
    expect(found?.segmentIndex).toBe(0);
  });

  it('falls back to findLineSplitAtPoint without hint', () => {
    const found = resolveLineSplitCandidate(37.605, 55.7525, [line({})]);
    expect(found?.line.id).toBe('line-1');
  });
});

describe('applyInfraLineSplit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates first half and creates second line', async () => {
    const { mapApi, networkApi } = createSplitMocks();
    const splitLine = line({});
    const candidate = {
      line: splitLine,
      segmentIndex: 0,
      snapLon: 37.605,
      snapLat: 55.7525,
      distanceKm: 0,
    };
    vi.mocked(mapApi.updateInfraObject).mockResolvedValue({
      ...splitLine,
      coordinates: [
        [37.6, 55.75],
        [37.605, 55.7525],
      ],
    } as InfraObject);
    vi.mocked(mapApi.createInfraObject).mockResolvedValue({
      ...splitLine,
      id: 'line-2',
      name: 'Дорога_1 (2)',
    } as InfraObject);
    vi.mocked(networkApi.buildNetwork).mockResolvedValue({} as never);

    const result = await applyInfraLineSplit({
      projectId: 'proj-1',
      split: candidate,
      splitLon: 37.605,
      splitLat: 55.7525,
      mapApi,
      networkApi,
    });

    expect(result).not.toBeNull();
    expect(mapApi.updateInfraObject).toHaveBeenCalledOnce();
    expect(mapApi.createInfraObject).toHaveBeenCalledOnce();
    expect(networkApi.buildNetwork).toHaveBeenCalledWith('proj-1');
    expect(result!.second.name).toBe('Дорога_1 (2)');
  });

  it('returns null when split plan cannot be built', async () => {
    const { mapApi, networkApi } = createSplitMocks();
    const splitLine = line({ coordinates: [[37.6, 55.75], [37.62, 55.76]] });
    const result = await applyInfraLineSplit({
      projectId: 'proj-1',
      split: {
        line: splitLine,
        segmentIndex: 99,
        snapLon: 37.605,
        snapLat: 55.7525,
        distanceKm: 0,
      },
      splitLon: 37.605,
      splitLat: 55.7525,
      mapApi,
      networkApi,
    });
    expect(result).toBeNull();
    expect(mapApi.updateInfraObject).not.toHaveBeenCalled();
  });
});
