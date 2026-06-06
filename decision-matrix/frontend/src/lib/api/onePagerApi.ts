import { request, requestBlob } from './client';
import type { OnePager, OnePagerCreatePayload, OnePagerUpdatePayload } from './onePager';

export const onePagerApi = {
  getOnePagers: (projectId: string) => request<OnePager[]>(`/projects/${projectId}/one-pagers`),
  getOnePager: (projectId: string, id: string) =>
    request<OnePager>(`/projects/${projectId}/one-pagers/${id}`),
  createOnePager: (projectId: string, body: OnePagerCreatePayload) =>
    request<OnePager>(`/projects/${projectId}/one-pagers`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateOnePager: (projectId: string, id: string, body: OnePagerUpdatePayload) =>
    request<OnePager>(`/projects/${projectId}/one-pagers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteOnePager: (projectId: string, id: string) =>
    request<void>(`/projects/${projectId}/one-pagers/${id}`, { method: 'DELETE' }),
  exportOnePagerPptx: (projectId: string, id: string, mapSnapshotBase64?: string | null) =>
    requestBlob(`/projects/${projectId}/one-pagers/${id}/export/pptx`, {
      method: 'POST',
      body: JSON.stringify({ map_snapshot_base64: mapSnapshotBase64 ?? null }),
    }),
};
