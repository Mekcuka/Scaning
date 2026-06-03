import { api, type ProjectJobCreateResponse } from './api';
import { isProjectJobCreateResponse, pollProjectJobUntilDone } from './pollProjectJob';

/** If POST returned 202 job envelope, poll until done and return job.result. */
export async function unwrapApiJobResponse<T>(
  projectId: string,
  response: T | ProjectJobCreateResponse,
): Promise<T> {
  if (!isProjectJobCreateResponse(response)) {
    return response;
  }
  const job = await pollProjectJobUntilDone(projectId, response.job_id);
  return job.result as T;
}

export async function analyzeAllPoisAndWait(projectId: string) {
  const res = await api.analyzeAllPois(projectId);
  return unwrapApiJobResponse<import('./api').ProjectAnalysisBatchResult>(projectId, res);
}

export async function analyzeSandLogisticsAndWait(
  projectId: string,
  options?: Parameters<typeof api.analyzeSandLogistics>[1],
) {
  const res = await api.analyzeSandLogistics(projectId, options);
  if (isProjectJobCreateResponse(res)) {
    await pollProjectJobUntilDone(projectId, res.job_id);
    const stored = await api.getSandLogisticsResult(projectId);
    if (!stored) throw new Error('Результат логистики песка не найден после расчёта');
    return stored;
  }
  return res;
}
