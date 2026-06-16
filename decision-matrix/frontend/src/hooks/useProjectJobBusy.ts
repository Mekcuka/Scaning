import type { ProjectJobResponse } from '../lib/api';
import { ACTIVE_JOB_STATUSES } from '../lib/taskLog/jobLabels';
import { useTaskLogStore } from '../lib/taskLog/store';

function findActiveJob(entries: { kind: string; job?: ProjectJobResponse }[]): ProjectJobResponse | null {
  for (const e of entries) {
    if (e.kind === 'project_job' && e.job && ACTIVE_JOB_STATUSES.has(e.job.status)) {
      return e.job;
    }
  }
  return null;
}

/** Busy flag from task log store (no REST polling). */
export function useProjectJobBusy(projectId: string | null | undefined): boolean {
  return useTaskLogStore((s) => {
    if (!projectId) return false;
    return findActiveJob(s.byProject[projectId] ?? []) !== null;
  });
}

/** Active job from task log store (updated by ProjectJobSync). */
export function useStoredActiveProjectJob(
  projectId: string | null | undefined,
): ProjectJobResponse | null {
  return useTaskLogStore((s) => {
    if (!projectId) return null;
    return findActiveJob(s.byProject[projectId] ?? []);
  });
}
