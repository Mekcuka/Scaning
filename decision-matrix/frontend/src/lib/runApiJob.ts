import {
  defaultAnalysisBatchApi,
  defaultProjectJobsApi,
  defaultSandLogisticsApi,
  type AnalysisBatchApiPort,
  type ProjectJobCreateResponse,
  type ProjectJobsApiPort,
} from './api';
import { isProjectJobCreateResponse, pollProjectJobUntilDone } from './pollProjectJob';

/** If POST returned 202 job envelope, poll until done and return job.result. */
export async function unwrapApiJobResponse<T>(
  projectId: string,
  response: T | ProjectJobCreateResponse,
  jobsApi: ProjectJobsApiPort = defaultProjectJobsApi,
): Promise<T> {
  if (!isProjectJobCreateResponse(response)) {
    return response;
  }
  const job = await pollProjectJobUntilDone(projectId, response.job_id, { jobsApi });
  return job.result as T;
}

export async function analyzeAllPoisAndWait(
  projectId: string,
  options?: {
    analysisApi?: AnalysisBatchApiPort;
    jobsApi?: ProjectJobsApiPort;
  },
) {
  const analysisApi = options?.analysisApi ?? defaultAnalysisBatchApi;
  const jobsApi = options?.jobsApi ?? defaultProjectJobsApi;
  const res = await analysisApi.analyzeAllPois(projectId);
  return unwrapApiJobResponse<import('./api').ProjectAnalysisBatchResult>(projectId, res, jobsApi);
}

export async function analyzeSandLogisticsAndWait(
  projectId: string,
  options?: Parameters<typeof defaultSandLogisticsApi.analyzeSandLogistics>[1],
) {
  const res = await defaultSandLogisticsApi.analyzeSandLogistics(projectId, options);
  if (isProjectJobCreateResponse(res)) {
    await pollProjectJobUntilDone(projectId, res.job_id);
    const stored = await defaultSandLogisticsApi.getSandLogisticsResult(projectId);
    if (!stored) throw new Error('Результат логистики песка не найден после расчёта');
    return stored;
  }
  return res;
}
