import { adminApi } from '../adminApi';

/** Admin users and stats page. */
export type AdminUsersApiPort = Pick<
  typeof adminApi,
  'adminUsers' | 'adminStats' | 'updateAdminUser'
>;

/** Admin jobs journal page. */
export type AdminJobsApiPort = Pick<
  typeof adminApi,
  'adminListJobs' | 'adminJobsHealth' | 'adminCancelJob'
>;

export const defaultAdminUsersApi: AdminUsersApiPort = adminApi;
export const defaultAdminJobsApi: AdminJobsApiPort = adminApi;
