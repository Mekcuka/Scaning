import { request } from './client';
import type { DistanceDefaults, POI, Project } from './entities';
import type { EconomicParamsDto } from '../economicFlowSchematic';

export const projectsApi = {
  projects: () => request<Project[]>('/projects'),
  createProject: (name: string, description?: string) =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify({ name, description }) }),
  getProject: (id: string) => request<Project>(`/projects/${id}`),
  updateProject: (
    id: string,
    data: Partial<Pick<Project, 'name' | 'description' | 'status' | 'visibility'>>,
  ) => request<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProject: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
  getRates: (projectId: string) =>
    request<{ project_id: string; rates: Record<string, number> }>(`/projects/${projectId}/rates`),
  updateRates: (projectId: string, rates: Record<string, number>) =>
    request(`/projects/${projectId}/rates`, { method: 'PUT', body: JSON.stringify({ rates }) }),
  getPois: (projectId: string) => request<POI[]>(`/projects/${projectId}/pois`),
  createPoi: (
    projectId: string,
    data: Partial<POI> & { lon: number; lat: number; name: string },
    opts?: { timeoutMs?: number },
  ) =>
    request<POI>(`/projects/${projectId}/pois`, {
      method: 'POST',
      body: JSON.stringify(data),
      timeoutMs: opts?.timeoutMs,
    }),
  updatePoi: (projectId: string, poiId: string, data: Partial<POI> & { lon?: number; lat?: number }) =>
    request<POI>(`/projects/${projectId}/pois/${poiId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePoi: (projectId: string, poiId: string) =>
    request<void>(`/projects/${projectId}/pois/${poiId}`, { method: 'DELETE' }),
  getDistanceDefaults: (projectId: string) =>
    request<DistanceDefaults>(`/projects/${projectId}/distance-defaults`),
  updateDistanceDefaults: (projectId: string, data: Partial<DistanceDefaults>) =>
    request<DistanceDefaults>(`/projects/${projectId}/distance-defaults`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getEconomicParams: (projectId: string) =>
    request<EconomicParamsDto>(`/projects/${projectId}/economic-params`),
  updateEconomicParams: (projectId: string, params: Record<string, number>) =>
    request<EconomicParamsDto>(`/projects/${projectId}/economic-params`, {
      method: 'PUT',
      body: JSON.stringify({ params }),
    }),
};
