import { create } from 'zustand';

import type { ProjectJobResponse } from '../api';
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
  mergeJobsFromApi: (projectId: string, jobs: ProjectJobResponse[]) => void;
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
          label: path.split('/').slice(-2).join('/') || 'API',
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
      if (httpFlowId) {
        list = list.map((e) => {
          if (e.kind === 'http_flow' && e.id === httpFlowId) {
            return { ...e, linkedJobId: jobId };
          }
          return e;
        });
      }
      const entry: TaskLogEntry = {
        kind: 'project_job',
        id: jobId,
        projectId,
        job,
        httpSteps: [],
        updatedAt: Date.now(),
      };
      const flow = httpFlowId
        ? list.find((e) => e.kind === 'http_flow' && e.id === httpFlowId)
        : null;
      if (flow?.kind === 'http_flow') {
        entry.httpSteps = [...flow.steps];
      }
      return { byProject: upsertProjectEntry({ ...s.byProject, [projectId]: list }, projectId, entry) };
    });
  },

  updateJob: (job, httpSteps) => {
    const projectId = job.project_id;
    set((s) => {
      const list = s.byProject[projectId] ?? loadProjectEntries(projectId);
      const existing = list.find((e) => e.kind === 'project_job' && e.id === job.id);
      const entry: TaskLogEntry = {
        kind: 'project_job',
        id: job.id,
        projectId,
        job,
        httpSteps: httpSteps ?? (existing?.kind === 'project_job' ? existing.httpSteps : []),
        updatedAt: Date.now(),
      };
      return { byProject: upsertProjectEntry(s.byProject, projectId, entry) };
    });
  },

  mergeJobsFromApi: (projectId, jobs) => {
    set((s) => {
      let byProject = { ...s.byProject };
      for (const job of jobs) {
        const list = byProject[projectId] ?? loadProjectEntries(projectId);
        const existing = list.find((e) => e.kind === 'project_job' && e.id === job.id);
        const entry: TaskLogEntry = {
          kind: 'project_job',
          id: job.id,
          projectId,
          job,
          httpSteps: existing?.kind === 'project_job' ? existing.httpSteps : [],
          updatedAt: Date.now(),
        };
        byProject = upsertProjectEntry(byProject, projectId, entry);
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
export const taskLog = {
  startHttpFlow: (...a: Parameters<TaskLogState['startHttpFlow']>) => useTaskLogStore.getState().startHttpFlow(...a),
  endHttpFlow: (...a: Parameters<TaskLogState['endHttpFlow']>) => useTaskLogStore.getState().endHttpFlow(...a),
  recordHttpStep: (...a: Parameters<TaskLogState['recordHttpStep']>) =>
    useTaskLogStore.getState().recordHttpStep(...a),
  registerJob: (...a: Parameters<TaskLogState['registerJob']>) => useTaskLogStore.getState().registerJob(...a),
  updateJob: (...a: Parameters<TaskLogState['updateJob']>) => useTaskLogStore.getState().updateJob(...a),
};
