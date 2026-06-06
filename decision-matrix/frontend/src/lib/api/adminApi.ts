import { request } from './client';
import type { AdminJobsHealthResponse, ProjectJobAdminItem, ProjectJobAdminListResponse } from './jobs';

export type AdminUserRow = {
  id: string;
  email: string;
  username: string;
  role: string;
  is_active: boolean;
  created_at: string;
  project_count: number;
};

export const adminApi = {
  adminUsers: async () => {
    const rows = await request<
      Array<{
        id: string;
        email: string;
        username: string;
        role: string;
        is_active: boolean;
        created_at: string;
        project_count?: number;
      }>
    >('/admin/users');
    return rows.map((row) => ({
      ...row,
      project_count: typeof row.project_count === 'number' ? row.project_count : 0,
    }));
  },
  updateAdminUser: (id: string, data: { role?: string; is_active?: boolean }) =>
    request(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  adminStats: () => request<{ users: number; projects: number; pois: number }>('/admin/stats'),
  adminListJobs: (params?: {
    status?: string[];
    job_type?: string;
    project_id?: string;
    limit?: number;
    offset?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.status?.length) {
      for (const s of params.status) q.append('status', s);
    }
    if (params?.job_type) q.set('job_type', params.job_type);
    if (params?.project_id) q.set('project_id', params.project_id);
    if (params?.limit != null) q.set('limit', String(params.limit));
    if (params?.offset != null) q.set('offset', String(params.offset));
    const qs = q.toString();
    return request<ProjectJobAdminListResponse>(`/admin/jobs${qs ? `?${qs}` : ''}`);
  },
  adminJobsHealth: () => request<AdminJobsHealthResponse>('/admin/jobs/health'),
  adminCancelJob: (jobId: string) =>
    request<ProjectJobAdminItem>(`/admin/jobs/${jobId}/cancel`, { method: 'POST' }),
};
