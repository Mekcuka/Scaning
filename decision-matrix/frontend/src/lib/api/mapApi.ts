import { request } from './client';
import type {
  FacilityInfraObjectCreate,
  InfraLayer,
  InfraObject,
  InfraObjectCreate,
  Map3dCustomModel,
} from './entities';

export const mapApi = {
  deleteLayer: (projectId: string, layerId: string) =>
    request<void>(`/projects/${projectId}/infrastructure/layers/${layerId}`, { method: 'DELETE' }),
  getLayers: (projectId: string) => request<InfraLayer[]>(`/projects/${projectId}/infrastructure/layers`),
  createLayer: (projectId: string, data: Partial<InfraLayer> & { name: string }) =>
    request<InfraLayer>(`/projects/${projectId}/infrastructure/layers`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateLayer: (projectId: string, layerId: string, data: Partial<InfraLayer>) =>
    request<InfraLayer>(`/projects/${projectId}/infrastructure/layers/${layerId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  getInfraObjects: (
    projectId: string,
    params?: { subtype?: string; q?: string; bbox?: string; visibleLayersOnly?: boolean },
  ) => {
    const qs = new URLSearchParams();
    if (params?.subtype) qs.set('subtype', params.subtype);
    if (params?.q) qs.set('q', params.q);
    if (params?.bbox) qs.set('bbox', params.bbox);
    if (params?.visibleLayersOnly === true) qs.set('visible_layers_only', 'true');
    else qs.set('visible_layers_only', 'false');
    const query = qs.toString();
    return request<InfraObject[]>(
      `/projects/${projectId}/infrastructure/objects${query ? `?${query}` : ''}`,
    );
  },
  listMap3dCustomModels: (projectId: string) =>
    request<Map3dCustomModel[]>(`/projects/${projectId}/map3d-custom-models`),
  uploadMap3dCustomModel: (projectId: string, file: File, targetHeightM?: number) => {
    const fd = new FormData();
    fd.append('file', file);
    if (targetHeightM != null) fd.append('target_height_m', String(targetHeightM));
    return request<Map3dCustomModel>(`/projects/${projectId}/map3d-custom-models`, {
      method: 'POST',
      body: fd,
    });
  },
  deleteMap3dCustomModel: (projectId: string, modelId: string) =>
    request<void>(`/projects/${projectId}/map3d-custom-models/${modelId}`, { method: 'DELETE' }),
  assignMap3dCustomModel: (projectId: string, modelId: string, subtypes: string[]) =>
    request<Map3dCustomModel>(`/projects/${projectId}/map3d-custom-models/${modelId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ subtypes }),
    }),
  createInfraObject: (projectId: string, data: InfraObjectCreate, opts?: { timeoutMs?: number }) =>
    request<InfraObject>(`/projects/${projectId}/infrastructure/objects`, {
      method: 'POST',
      body: JSON.stringify(data),
      timeoutMs: opts?.timeoutMs,
    }),
  /** НПЗ (refinery), НПС (oil_pumping_station) — subtype в теле обязателен. */
  createFacilityInfraObject: (projectId: string, data: FacilityInfraObjectCreate) =>
    request<InfraObject>(`/projects/${projectId}/infrastructure/facility-objects`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateInfraObject: (projectId: string, objectId: string, data: Partial<InfraObjectCreate>) =>
    request<InfraObject>(`/projects/${projectId}/infrastructure/objects/${objectId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  clearProjectInfrastructure: (projectId: string) =>
    request<{ deleted_objects: number; deleted_edges: number; deleted_nodes: number }>(
      `/projects/${projectId}/infrastructure/clear`,
      { method: 'POST' },
    ),
  deleteInfraObject: (projectId: string, objectId: string) =>
    request<void>(`/projects/${projectId}/infrastructure/objects/${objectId}`, { method: 'DELETE' }),
  batchDeleteMapObjects: (
    projectId: string,
    data: { object_ids: string[]; poi_ids?: string[] },
  ) =>
    request<{ deleted_objects: number; deleted_pois: number; network_rebuilt: boolean }>(
      `/projects/${projectId}/map/batch-delete`,
      { method: 'POST', body: JSON.stringify(data) },
    ),
};
