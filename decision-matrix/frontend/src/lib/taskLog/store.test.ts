import { beforeEach, describe, expect, it } from 'vitest';

import { useTaskLogStore } from './store';

describe('taskLog store', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useTaskLogStore.setState({ byProject: {}, activeFlowId: null, activeFlowProjectId: null });
  });

  it('records http flow steps', () => {
    const projectId = '11111111-1111-1111-1111-111111111111';
    const flowId = useTaskLogStore.getState().startHttpFlow(projectId, 'test', 'Test flow');
    useTaskLogStore.getState().recordHttpStep({
      projectId,
      method: 'POST',
      path: `/projects/${projectId}/autoroad-network/request`,
      status: 200,
      requestBody: { a: 1 },
      responseBody: { b: 2 },
      flowId,
    });
    const entries = useTaskLogStore.getState().byProject[projectId] ?? [];
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe('http_flow');
    if (entries[0].kind === 'http_flow') {
      expect(entries[0].steps).toHaveLength(1);
      expect(entries[0].steps[0].requestBody).toEqual({ a: 1 });
    }
  });

  it('registers and updates project job', () => {
    const projectId = '22222222-2222-2222-2222-222222222222';
    const jobId = '33333333-3333-3333-3333-333333333333';
    useTaskLogStore.getState().registerJob({
      projectId,
      jobId,
      jobType: 'autoroad_connect',
      payload: { object_ids: ['a'] },
    });
    useTaskLogStore.getState().updateJob({
      id: jobId,
      project_id: projectId,
      job_type: 'autoroad_connect',
      status: 'completed',
      result: { ok: true },
    });
    const entry = useTaskLogStore.getState().byProject[projectId]?.[0];
    expect(entry?.kind).toBe('project_job');
    if (entry?.kind === 'project_job') {
      expect(entry.job.status).toBe('completed');
      expect(entry.job.result).toEqual({ ok: true });
    }
  });
});
