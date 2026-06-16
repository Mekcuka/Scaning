import { create } from 'zustand';

import type { ProjectJobResponse, JobStepResponse } from '../api';
import { HTTP_FLOW_PATH_LABELS } from './jobLabels';
import type { HttpStep, TaskLogEntry, TaskLogStatus } from './types';

const MAX_ENTRIES_PER_PROJECT = 30;
const STORAGE_PREFIX = 'taskLog:';

function storageKey(projectId: string): string {
  return `${STORAGE_PREFIX}${projectId}`;
}

function loadProjectEntries(projectId: string): TaskLogEntry[] {
  try {
    const raw = sessionStorage.getItem(storageKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TaskLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveProjectEntries(projectId: string, entries: TaskLogEntry[]): void {
  try {
    sessionStorage.setItem(storageKey(projectId), JSON.stringify(entries.slice(0, MAX_ENTRIES_PER_PROJECT)));
  } catch {
    /* quota */
  }
}

function newId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const TERMINAL_JOB_STATUSES = new Set(['completed', 'failed', 'cancelled']);
const TERMINAL_STEP_STATUSES = new Set(['ok', 'warn', 'error', 'skipped']);

function mergeJobFields(
  existing: ProjectJobResponse,
  patch: Partial<ProjectJobResponse>,
): ProjectJobResponse {
  const next = { ...existing };
  for (const [key, value] of Object.entries(patch) as [keyof ProjectJobResponse, unknown][]) {
    if (value === undefined) continue;
    if ((key === 'status' || key === 'job_type') && value === '') continue;
    (next as Record<string, unknown>)[key] = value;
  }
  return next;
}

function recomputeJobFromSteps(
  job: ProjectJobResponse,
  stepsById: Record<string, JobStepResponse>,
): ProjectJobResponse {
  const steps = Object.values(stepsById).sort((a, b) => a.seq - b.seq);
  const stepsTotal = steps.length;
  const stepsCompleted = steps.filter((s) => TERMINAL_STEP_STATUSES.has(s.status)).length;
  const running = steps.find((s) => s.status === 'running');
  const progress = stepsTotal > 0 ? Math.round((stepsCompleted / stepsTotal) * 10000) / 10000 : job.progress;
  return {
    ...job,
    steps_total: stepsTotal || job.steps_total,
    steps_completed: stepsCompleted,
    progress: progress ?? job.progress,
    current_step: running
      ? { seq: running.seq, step_code: running.step_code, title: running.title }
      : job.current_step,
  };
}

function httpFlowLabelForPath(path: string): string {
  const tail = path.split('/').slice(-2).join('/');
  return HTTP_FLOW_PATH_LABELS[tail] ?? (tail || 'API');
}

function jobStatusToFlowStatus(status: string): TaskLogStatus {
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  if (status === 'cancelled') return 'cancelled';
  return 'running';
}

function findHttpFlowForPath(
  list: TaskLogEntry[],
  path: string,
  runningOnly = true,
): Extract<TaskLogEntry, { kind: 'http_flow' }> | undefined {
  return list.find(
    (e): e is Extract<TaskLogEntry, { kind: 'http_flow' }> =>
      e.kind === 'http_flow' &&
      (!runningOnly || e.status === 'running') &&
      e.steps.some((s) => s.path === path),
  );
}

function finalizeLinkedHttpFlows(
  list: TaskLogEntry[],
  jobId: string,
  flowStatus: TaskLogStatus,
): TaskLogEntry[] {
  const now = Date.now();
  return list.map((e) => {
    if (e.kind !== 'http_flow' || e.status !== 'running') return e;
    if (e.linkedJobId !== jobId) return e;
    return { ...e, status: flowStatus, finishedAt: now };
  });
}

function upsertProjectEntry(
  byProject: Record<string, TaskLogEntry[]>,
  projectId: string,
  entry: TaskLogEntry,
): Record<string, TaskLogEntry[]> {
  const list = [...(byProject[projectId] ?? loadProjectEntries(projectId))];
  const idx = list.findIndex((e) => e.id === entry.id);
  if (idx >= 0) list[idx] = entry;
  else list.unshift(entry);
  const trimmed = list.slice(0, MAX_ENTRIES_PER_PROJECT);
  saveProjectEntries(projectId, trimmed);
  return { ...byProject, [projectId]: trimmed };
}

type TaskLogState = {
  byProject: Record<string, TaskLogEntry[]>;
  activeFlowId: string | null;
  activeFlowProjectId: string | null;

  getEntries: (projectId: string | null | undefined) => TaskLogEntry[];
  hydrateProject: (projectId: string) => void;
  startHttpFlow: (projectId: string, flowKey: string, label: string) => string;
  endHttpFlow: (flowId: string, status: TaskLogStatus) => void;
  recordHttpStep: (args: {
    projectId: string;
    method: string;
    path: string;
    status: number;
    requestBody: unknown;
    responseBody: unknown;
    flowId?: string | null;
  }) => void;
  registerJob: (args: {
    projectId: string;
    jobId: string;
    jobType: string;
    status?: string;
    payload?: Record<string, unknown>;
    httpFlowId?: string | null;
  }) => void;
  updateJob: (job: ProjectJobResponse, httpSteps?: HttpStep[]) => void;
  patchJob: (projectId: string, jobId: string, patch: Partial<ProjectJobResponse>) => void;
  updateStep: (projectId: string, jobId: string, step: JobStepResponse) => void;
  mergeJobsFromApi: (projectId: string, jobs: ProjectJobResponse[]) => void;
  finalizeHttpFlowForPath: (projectId: string, path: string, status: TaskLogStatus) => void;
  clearProject: (projectId: string) => void;
};

export const useTaskLogStore = create<TaskLogState>((set, get) => ({
  byProject: {},
  activeFlowId: null,
  activeFlowProjectId: null,

  getEntries: (projectId) => {
    if (!projectId) return [];
    return get().byProject[projectId] ?? [];
  },

  hydrateProject: (projectId) => {
    if (get().byProject[projectId]) return;
    const loaded = loadProjectEntries(projectId);
    if (!loaded.length) return;
    set((s) => ({ byProject: { ...s.byProject, [projectId]: loaded } }));
  },

  startHttpFlow: (projectId, flowKey, label) => {
    const id = newId();
    const entry: TaskLogEntry = {
      kind: 'http_flow',
      id,
      projectId,
      flowKey,
      label,
      status: 'running',
      startedAt: Date.now(),
      steps: [],
    };
    set((s) => ({
      ...s,
      activeFlowId: id,
      activeFlowProjectId: projectId,
      byProject: upsertProjectEntry(s.byProject, projectId, entry),
    }));
    return id;
  },

  endHttpFlow: (flowId, status) => {
    set((s) => {
      const projectId = s.activeFlowProjectId;
      if (!projectId) return s;
      const list = s.byProject[projectId] ?? loadProjectEntries(projectId);
      const entry = list.find((e) => e.kind === 'http_flow' && e.id === flowId);
      if (!entry || entry.kind !== 'http_flow') return { ...s, activeFlowId: null, activeFlowProjectId: null };
      const updated: TaskLogEntry = {
        ...entry,
        status,
        finishedAt: Date.now(),
      };
      return {
        ...s,
        activeFlowId: null,
        activeFlowProjectId: null,
        byProject: upsertProjectEntry(s.byProject, projectId, updated),
      };
    });
  },

  recordHttpStep: ({ projectId, method, path, status, requestBody, responseBody, flowId }) => {
    const step: HttpStep = {
      id: newId(),
      method,
      path,
      status,
      at: Date.now(),
      requestBody,
      responseBody,
    };
    set((s) => {
      const list = [...(s.byProject[projectId] ?? loadProjectEntries(projectId))];
      const targetFlowId = flowId ?? s.activeFlowId;
      let flowEntry = targetFlowId
        ? list.find((e) => e.kind === 'http_flow' && e.id === targetFlowId)
        : undefined;

      if (!flowEntry) {
        const id = newId();
        flowEntry = {
          kind: 'http_flow',
          id,
          projectId,
          flowKey: 'api',
          label: httpFlowLabelForPath(path),
          status: status >= 400 ? 'failed' : 'running',
          startedAt: Date.now(),
          steps: [],
        };
      }

      if (flowEntry.kind !== 'http_flow') return s;

      const updated: TaskLogEntry = {
        ...flowEntry,
        steps: [...flowEntry.steps, step],
        status:
          status >= 400
            ? 'failed'
            : flowEntry.status === 'failed'
              ? 'failed'
              : 'running',
        finishedAt: status >= 400 ? Date.now() : flowEntry.finishedAt,
      };
      return { byProject: upsertProjectEntry(s.byProject, projectId, updated) };
    });
  },

  registerJob: ({ projectId, jobId, jobType, status, payload, httpFlowId }) => {
    const job: ProjectJobResponse = {
      id: jobId,
      project_id: projectId,
      job_type: jobType,
      status: status ?? 'pending',
      payload: payload ?? {},
    };
    set((s) => {
      let list = s.byProject[projectId] ?? loadProjectEntries(projectId);
      let linkedFlowId = httpFlowId;
      if (!linkedFlowId) {
        const recentFlow = list.find(
          (e): e is Extract<TaskLogEntry, { kind: 'http_flow' }> =>
            e.kind === 'http_flow' && e.status === 'running' && !e.linkedJobId,
        );
        linkedFlowId = recentFlow?.id;
      }
      if (linkedFlowId) {
        list = list.map((e) =>
          e.kind === 'http_flow' && e.id === linkedFlowId ? { ...e, linkedJobId: jobId } : e,
        );
      }
      const flow = list.find(
        (e): e is Extract<TaskLogEntry, { kind: 'http_flow' }> =>
          e.kind === 'http_flow' && e.linkedJobId === jobId,
      );
      const entry: TaskLogEntry = {
        kind: 'project_job',
        id: jobId,
        projectId,
        job,
        httpSteps: flow ? [...flow.steps] : [],
        updatedAt: Date.now(),
      };
      return { byProject: upsertProjectEntry({ ...s.byProject, [projectId]: list }, projectId, entry) };
    });
  },

  updateJob: (job, httpSteps) => {
    const projectId = job.project_id;
    set((s) => {
      let list = s.byProject[projectId] ?? loadProjectEntries(projectId);
      const existing = list.find((e) => e.kind === 'project_job' && e.id === job.id);
      const mergedJob = existing?.kind === 'project_job' ? mergeJobFields(existing.job, job) : job;
      const entry: TaskLogEntry = {
        kind: 'project_job',
        id: job.id,
        projectId,
        job: mergedJob,
        httpSteps: httpSteps ?? (existing?.kind === 'project_job' ? existing.httpSteps : []),
        stepsById: existing?.kind === 'project_job' ? existing.stepsById : undefined,
        updatedAt: Date.now(),
      };
      if (TERMINAL_JOB_STATUSES.has(mergedJob.status)) {
        list = finalizeLinkedHttpFlows(list, job.id, jobStatusToFlowStatus(mergedJob.status));
      }
      return { byProject: upsertProjectEntry({ ...s.byProject, [projectId]: list }, projectId, entry) };
    });
  },

  patchJob: (projectId, jobId, patch) => {
    set((s) => {
      const list = s.byProject[projectId] ?? loadProjectEntries(projectId);
      const existing = list.find((e) => e.kind === 'project_job' && e.id === jobId);
      if (!existing || existing.kind !== 'project_job') return s;
      let job = mergeJobFields(existing.job, patch);
      if (existing.stepsById && Object.keys(existing.stepsById).length > 0) {
        job = recomputeJobFromSteps(job, existing.stepsById);
      }
      const entry: TaskLogEntry = {
        ...existing,
        job,
        updatedAt: Date.now(),
      };
      if (TERMINAL_JOB_STATUSES.has(job.status)) {
        const nextList = finalizeLinkedHttpFlows(list, jobId, jobStatusToFlowStatus(job.status));
        return { byProject: upsertProjectEntry({ ...s.byProject, [projectId]: nextList }, projectId, entry) };
      }
      return { byProject: upsertProjectEntry(s.byProject, projectId, entry) };
    });
  },

  updateStep: (projectId, jobId, step) => {
    set((s) => {
      const list = s.byProject[projectId] ?? loadProjectEntries(projectId);
      const existing = list.find((e) => e.kind === 'project_job' && e.id === jobId);
      const stepsById = {
        ...(existing?.kind === 'project_job' ? existing.stepsById : undefined),
        [step.id]: step,
      };
      const baseJob =
        existing?.kind === 'project_job'
          ? existing.job
          : ({
              id: jobId,
              project_id: projectId,
              job_type: '',
              status: 'running',
              payload: {},
            } satisfies ProjectJobResponse);
      const job = recomputeJobFromSteps(baseJob, stepsById);
      const entry: TaskLogEntry = {
        kind: 'project_job',
        id: jobId,
        projectId,
        job,
        httpSteps: existing?.kind === 'project_job' ? existing.httpSteps : [],
        stepsById,
        updatedAt: Date.now(),
      };
      return { byProject: upsertProjectEntry(s.byProject, projectId, entry) };
    });
  },

  finalizeHttpFlowForPath: (projectId, path, status) => {
    set((s) => {
      const list = s.byProject[projectId] ?? loadProjectEntries(projectId);
      const flow = findHttpFlowForPath(list, path);
      if (!flow) return s;
      const updated: TaskLogEntry = {
        ...flow,
        status,
        finishedAt: Date.now(),
      };
      return { byProject: upsertProjectEntry(s.byProject, projectId, updated) };
    });
  },

  mergeJobsFromApi: (projectId, jobs) => {
    set((s) => {
      let byProject = { ...s.byProject };
      for (const job of jobs) {
        let list = byProject[projectId] ?? loadProjectEntries(projectId);
        const existing = list.find((e) => e.kind === 'project_job' && e.id === job.id);
        if (TERMINAL_JOB_STATUSES.has(job.status)) {
          list = finalizeLinkedHttpFlows(list, job.id, jobStatusToFlowStatus(job.status));
        }
        const entry: TaskLogEntry = {
          kind: 'project_job',
          id: job.id,
          projectId,
          job,
          httpSteps: existing?.kind === 'project_job' ? existing.httpSteps : [],
          updatedAt: Date.now(),
        };
        byProject = upsertProjectEntry({ ...byProject, [projectId]: list }, projectId, entry);
      }
      return { byProject };
    });
  },

  clearProject: (projectId) => {
    sessionStorage.removeItem(storageKey(projectId));
    set((s) => {
      const next = { ...s.byProject };
      delete next[projectId];
      return { byProject: next };
    });
  },
}));

/** Imperative access for api.ts (outside React). */
export function isMultiStepHttpFlowActive(): boolean {
  return Boolean(useTaskLogStore.getState().activeFlowId);
}

export const taskLog = {
  startHttpFlow: (...a: Parameters<TaskLogState['startHttpFlow']>) => useTaskLogStore.getState().startHttpFlow(...a),
  endHttpFlow: (...a: Parameters<TaskLogState['endHttpFlow']>) => useTaskLogStore.getState().endHttpFlow(...a),
  recordHttpStep: (...a: Parameters<TaskLogState['recordHttpStep']>) =>
    useTaskLogStore.getState().recordHttpStep(...a),
  registerJob: (...a: Parameters<TaskLogState['registerJob']>) => useTaskLogStore.getState().registerJob(...a),
  updateJob: (...a: Parameters<TaskLogState['updateJob']>) => useTaskLogStore.getState().updateJob(...a),
  finalizeHttpFlowForPath: (...a: Parameters<TaskLogState['finalizeHttpFlowForPath']>) =>
    useTaskLogStore.getState().finalizeHttpFlowForPath(...a),
};
