import { jobsApi } from '../jobsApi';

/** Active and single-job polling for a project. */
export type ProjectJobsApiPort = Pick<
  typeof jobsApi,
  'getActiveProjectJob' | 'getProjectJob' | 'listProjectJobs' | 'cancelProjectJob'
>;

export const defaultProjectJobsApi: ProjectJobsApiPort = jobsApi;
