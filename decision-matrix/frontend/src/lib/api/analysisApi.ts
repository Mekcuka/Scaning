import { request } from './client';
import type { AnalysisResult, Candidate, PoiAnalysisResponse, ProjectAnalysisBatchResult } from './analysis';
import type { ProjectJobCreateResponse } from './jobs';

export const analysisApi = {
  analyzePoi: (projectId: string, poiId: string) =>
    request<AnalysisResult>(`/projects/${projectId}/pois/${poiId}/analyze`, { method: 'POST' }),
  analyzeAllPois: (projectId: string) =>
    request<ProjectAnalysisBatchResult | ProjectJobCreateResponse>(
      `/projects/${projectId}/pois/analyze-all`,
      { method: 'POST', timeoutMs: 120_000 },
    ),
  getPoiAnalysis: (projectId: string, poiId: string) =>
    request<PoiAnalysisResponse>(`/projects/${projectId}/pois/${poiId}/analysis`),
  getCandidates: (
    projectId: string,
    poiId: string,
    subtype: string,
    limit = 20,
    paramType?: 'external' | 'external_linear',
  ) => {
    const qs = new URLSearchParams({
      subtype,
      limit: String(limit),
    });
    if (paramType) qs.set('param_type', paramType);
    return request<Candidate[]>(`/projects/${projectId}/pois/${poiId}/candidates?${qs}`);
  },
  overrideAnalysis: (
    projectId: string,
    poiId: string,
    subtype: string,
    body: {
      nearest_object_id?: string;
      nearest_node_id?: string;
      force_construction?: boolean;
      param_type?: 'external' | 'external_linear';
    },
  ) =>
    request<PoiAnalysisResponse>(`/projects/${projectId}/pois/${poiId}/analysis/${subtype}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};
