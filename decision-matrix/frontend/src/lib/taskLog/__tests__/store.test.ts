import { beforeEach, describe, expect, it } from 'vitest';

import { isMultiStepHttpFlowActive, useTaskLogStore } from '../store';

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

  it('finalizes linked http flow when job completes', () => {
    const projectId = '44444444-4444-4444-4444-444444444444';
    const jobId = '55555555-5555-5555-5555-555555555555';
    const path = `/projects/${projectId}/pois/analyze-all`;
    useTaskLogStore.getState().recordHttpStep({
      projectId,
      method: 'POST',
      path,
      status: 202,
      requestBody: null,
      responseBody: { job_id: jobId },
    });
    useTaskLogStore.getState().registerJob({
      projectId,
      jobId,
      jobType: 'poi_analyze_all',
    });
    useTaskLogStore.getState().updateJob({
      id: jobId,
      project_id: projectId,
      job_type: 'poi_analyze_all',
      status: 'completed',
      result: { analyzed_count: 2 },
    });
    const entries = useTaskLogStore.getState().byProject[projectId] ?? [];
    const flow = entries.find((e) => e.kind === 'http_flow');
    const job = entries.find((e) => e.kind === 'project_job');
    expect(flow?.kind === 'http_flow' ? flow.status : null).toBe('completed');
    expect(job?.kind === 'project_job' ? job.job.status : null).toBe('completed');
  });

  it('finalizes http flow on synchronous 200-style completion', () => {
    const projectId = '66666666-6666-6666-6666-666666666666';
    const path = `/projects/${projectId}/pois/analyze-all`;
    expect(isMultiStepHttpFlowActive()).toBe(false);
    useTaskLogStore.getState().recordHttpStep({
      projectId,
      method: 'POST',
      path,
      status: 200,
      requestBody: null,
      responseBody: { analyzed_count: 1 },
    });
    useTaskLogStore.getState().finalizeHttpFlowForPath(projectId, path, 'completed');
    const flow = useTaskLogStore.getState().byProject[projectId]?.[0];
    expect(flow?.kind).toBe('http_flow');
    if (flow?.kind === 'http_flow') {
      expect(flow.status).toBe('completed');
      expect(flow.label).toBe('Анализ окружения');
    }
  });

  it('keeps multi-step http flow running while activeFlowId is set', () => {
    const projectId = '77777777-7777-7777-7777-777777777777';
    const flowId = useTaskLogStore.getState().startHttpFlow(projectId, 'autoroad_network', 'Сеть');
    expect(isMultiStepHttpFlowActive()).toBe(true);
    const requestPath = `/projects/${projectId}/autoroad-network/request`;
    useTaskLogStore.getState().recordHttpStep({
      projectId,
      method: 'POST',
      path: requestPath,
      status: 200,
      requestBody: null,
      responseBody: { terminals: [] },
      flowId,
    });
    expect(isMultiStepHttpFlowActive()).toBe(true);
    const flow = useTaskLogStore.getState().byProject[projectId]?.find((e) => e.id === flowId);
    expect(flow?.kind === 'http_flow' ? flow.status : null).toBe('running');
    useTaskLogStore.getState().endHttpFlow(flowId, 'completed');
    expect(isMultiStepHttpFlowActive()).toBe(false);
  });
});
