import { request } from './client';
import type { ImportConnection, ImportConnectionCreate, ImportLog } from './importTypes';

export const importApi = {
  previewImport: (projectId: string, file: File, format: string) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<{ rows: Record<string, unknown>[]; errors: string[]; records_total: number }>(
      `/projects/${projectId}/import/preview?format=${format}`,
      { method: 'POST', body: fd },
    );
  },
  importGeojsonAsync: (projectId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<ImportLog>(`/projects/${projectId}/import/geojson/async`, { method: 'POST', body: fd });
  },
  importKmlAsync: (projectId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<ImportLog>(`/projects/${projectId}/import/kml/async`, { method: 'POST', body: fd });
  },
  importCsv: (projectId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<ImportLog>(`/projects/${projectId}/import/csv`, { method: 'POST', body: fd });
  },
  importGeojson: (projectId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<ImportLog>(`/projects/${projectId}/import/geojson`, { method: 'POST', body: fd });
  },
  importSpark: (projectId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<ImportLog>(`/projects/${projectId}/import/spark`, { method: 'POST', body: fd });
  },
  importSparkAsync: (projectId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<ImportLog>(`/projects/${projectId}/import/spark/async`, { method: 'POST', body: fd });
  },
  importKml: (projectId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<ImportLog>(`/projects/${projectId}/import/kml`, { method: 'POST', body: fd });
  },
  importShapefile: (projectId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<ImportLog>(`/projects/${projectId}/import/shapefile`, { method: 'POST', body: fd });
  },
  importCsvAsync: (projectId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<ImportLog>(`/projects/${projectId}/import/csv/async`, { method: 'POST', body: fd });
  },
  getImportLog: (logId: string) => request<ImportLog>(`/import/logs/${logId}`),
  getImportLogs: (projectId?: string) =>
    request<ImportLog[]>(`/import/logs${projectId ? `?project_id=${projectId}` : ''}`),
  getImportConnections: (projectId: string) =>
    request<ImportConnection[]>(`/projects/${projectId}/import_connections`),
  createImportConnection: (projectId: string, data: ImportConnectionCreate) =>
    request<ImportConnection>(`/projects/${projectId}/import_connections`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateImportConnection: (projectId: string, id: string, data: Partial<ImportConnectionCreate>) =>
    request<ImportConnection>(`/projects/${projectId}/import_connections/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteImportConnection: (projectId: string, id: string) =>
    request<void>(`/projects/${projectId}/import_connections/${id}`, { method: 'DELETE' }),
  testImportConnection: (projectId: string, id: string) =>
    request<{ ok: boolean; status_code?: number; error?: string }>(
      `/projects/${projectId}/import_connections/${id}/test`,
      { method: 'POST' },
    ),
  syncImportConnection: (projectId: string, id: string) =>
    request<{ imported: number }>(`/projects/${projectId}/import/sync/${id}`, { method: 'POST' }),
};
