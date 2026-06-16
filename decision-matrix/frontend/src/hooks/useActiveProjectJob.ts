import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { defaultProjectJobsApi, type ProjectJobsApiPort } from '../lib/api';
import { ACTIVE_JOB_STATUSES } from '../lib/taskLog/jobLabels';
import { useTaskLogStore } from '../lib/taskLog/store';

export type UseActiveProjectJobOptions = {
  jobsApi?: ProjectJobsApiPort;
  /** When true, REST polling is disabled (WebSocket is connected). */
  realtimeConnected?: boolean;
};

export function useActiveProjectJob(
  projectId: string | null | undefined,
  options: UseActiveProjectJobOptions = {},
) {
  const jobsApi = options.jobsApi ?? defaultProjectJobsApi;
  const realtimeConnected = options.realtimeConnected ?? false;
  const updateJob = useTaskLogStore((s) => s.updateJob);

  const query = useQuery({
    queryKey: ['activeJob', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      return jobsApi.getActiveProjectJob(projectId);
    },
    enabled: Boolean(projectId),
    refetchOnWindowFocus: false,
    refetchInterval: (q) => {
      if (realtimeConnected) return false;
      const job = q.state.data;
      return job && ACTIVE_JOB_STATUSES.has(job.status) ? 5000 : false;
    },
  });

  const job = query.data ?? null;

  useEffect(() => {
    if (!job) return;
    const list = useTaskLogStore.getState().byProject[job.project_id] ?? [];
    const existing = list.find((e) => e.kind === 'project_job' && e.id === job.id);
    if (
      existing?.kind === 'project_job' &&
      !ACTIVE_JOB_STATUSES.has(existing.job.status) &&
      ACTIVE_JOB_STATUSES.has(job.status)
    ) {
      return;
    }
    updateJob(job);
  }, [job, updateJob]);

  return {
    activeProjectJob: job,
    projectJobBusy: Boolean(job && ACTIVE_JOB_STATUSES.has(job.status)),
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
