import { request } from './client';
import type {
  ProjectJobCreateResponse,
  ProjectJobListResponse,
  ProjectJobResponse,
} from './jobs';

export const jobsApi = {
  getActiveProjectJob: (projectId: string) =>
    request<ProjectJobResponse | null>(`/projects/${projectId}/jobs/active`),
  listProjectJobs: (projectId: string, opts?: { limit?: number }) => {
    const limit = opts?.limit ?? 30;
    return request<ProjectJobListResponse>(`/projects/${projectId}/jobs?limit=${limit}`);
  },
  getProjectJob: (projectId: string, jobId: string) =>
    request<ProjectJobResponse>(`/projects/${projectId}/jobs/${jobId}`),
  cancelProjectJob: (projectId: string, jobId: string) =>
    request<ProjectJobResponse>(`/projects/${projectId}/jobs/${jobId}/cancel`, { method: 'POST' }),
  createProjectJob: (projectId: string, data: { job_type: string; payload?: Record<string, unknown> }) =>
    request<ProjectJobCreateResponse>(`/projects/${projectId}/jobs`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
