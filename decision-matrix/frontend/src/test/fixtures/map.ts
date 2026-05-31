import type { AnalysisResult, InfraLayer, POI, PoiAnalysisResponse } from '../../lib/api';
import { makeInfraLine, makeInfraPoint } from './infra';

export function makePoi(overrides: Partial<POI> = {}): POI {
  return {
    id: 'poi-1',
    project_id: 'p1',
    name: 'POI Alpha',
    lon: 37.62,
    lat: 55.76,
    properties: {},
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  } as POI;
}

export function makeLayer(overrides: Partial<InfraLayer> = {}): InfraLayer {
  return {
    id: 'layer-1',
    project_id: 'p1',
    name: 'Infrastructure',
    is_visible: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  } as InfraLayer;
}

export const samplePois = [makePoi(), makePoi({ id: 'poi-2', name: 'POI Beta' })];
export const sampleLayers = [makeLayer()];
export const sampleInfra = [
  makeInfraPoint(),
  makeInfraLine(),
];

export function makeAnalysisResponse(overrides: Partial<PoiAnalysisResponse> = {}): PoiAnalysisResponse {
  return {
    poi_id: 'poi-1',
    rows: [],
    computed_at: '2024-01-01T00:00:00Z',
    ...overrides,
  } as PoiAnalysisResponse;
}

export function makeAnalysisResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    analyzed_count: 1,
    results: [{ poi_id: 'poi-1', rows: [], computed_at: '2024-01-01T00:00:00Z' }],
    ...overrides,
  } as AnalysisResult;
}
