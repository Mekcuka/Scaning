import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { api } from '../lib/api';
import { ACTIVE_JOB_STATUSES } from '../lib/taskLog/jobLabels';
import { useTaskLogStore } from '../lib/taskLog/store';

export function useActiveProjectJob(projectId: string | null | undefined) {
  const updateJob = useTaskLogStore((s) => s.updateJob);

  const query = useQuery({
    queryKey: ['activeJob', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      return api.getActiveProjectJob(projectId);
    },
    enabled: Boolean(projectId),
    refetchInterval: (q) => {
      const job = q.state.data;
      return job && ACTIVE_JOB_STATUSES.has(job.status) ? 2000 : false;
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
