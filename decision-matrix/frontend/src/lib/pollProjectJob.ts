import { api, type ProjectJobResponse } from './api';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isProjectJobCreateResponse(
  value: unknown,
): value is { job_id: string; job_type: string; status: string } {
  return (
    value != null &&
    typeof value === 'object' &&
    'job_id' in value &&
    typeof (value as { job_id: unknown }).job_id === 'string'
  );
}

export async function pollProjectJobUntilDone(
  projectId: string,
  jobId: string,
  options?: { intervalMs?: number; timeoutMs?: number },
): Promise<ProjectJobResponse> {
  const intervalMs = options?.intervalMs ?? 1500;
  const timeoutMs = options?.timeoutMs ?? 600_000;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = await api.getProjectJob(projectId, jobId);
    if (job.status === 'completed') return job;
    if (job.status === 'failed') {
      throw new Error(job.error_message ?? 'Фоновая задача завершилась с ошибкой');
    }
    if (job.status === 'cancelled') {
      throw new Error('Задача отменена');
    }
    await sleep(intervalMs);
  }
  throw new Error('Превышено время ожидания фоновой задачи');
}
