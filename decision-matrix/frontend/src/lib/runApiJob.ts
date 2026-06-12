import * as apiPorts from './api';
import type {
  AnalysisBatchApiPort,
  ProjectJobCreateResponse,
  ProjectJobsApiPort,
} from './api';
import { isProjectJobCreateResponse, pollProjectJobUntilDone } from './pollProjectJob';

/** If POST returned 202 job envelope, poll until done and return job.result. */
export async function unwrapApiJobResponse<T>(
  projectId: string,
  response: T | ProjectJobCreateResponse,
  jobsApi?: ProjectJobsApiPort,
): Promise<T> {
  if (!isProjectJobCreateResponse(response)) {
    return response;
  }
  const resolvedJobsApi = jobsApi ?? apiPorts.defaultProjectJobsApi;
  const job = await pollProjectJobUntilDone(projectId, response.job_id, { jobsApi: resolvedJobsApi });
  return job.result as T;
}

export async function analyzeAllPoisAndWait(
  projectId: string,
  options?: {
    analysisApi?: AnalysisBatchApiPort;
    jobsApi?: ProjectJobsApiPort;
  },
) {
  const analysisApi = options?.analysisApi ?? apiPorts.defaultAnalysisBatchApi;
  const jobsApi = options?.jobsApi ?? apiPorts.defaultProjectJobsApi;
  const res = await analysisApi.analyzeAllPois(projectId);
  return unwrapApiJobResponse<import('./api').ProjectAnalysisBatchResult>(projectId, res, jobsApi);
}

export async function analyzeSandLogisticsAndWait(
  projectId: string,
  options?: Parameters<typeof apiPorts.defaultSandLogisticsApi.analyzeSandLogistics>[1],
) {
  const res = await apiPorts.defaultSandLogisticsApi.analyzeSandLogistics(projectId, options);
  if (isProjectJobCreateResponse(res)) {
    await pollProjectJobUntilDone(projectId, res.job_id);
    const stored = await apiPorts.defaultSandLogisticsApi.getSandLogisticsResult(projectId);
    if (!stored) throw new Error('Результат логистики песка не найден после расчёта');
    return stored;
  }
  return res;
}
