import type { ProjectJobResponse, JobStepResponse } from '../api';

export type TaskLogStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export type HttpStep = {
  id: string;
  method: string;
  path: string;
  status: number;
  at: number;
  requestBody: unknown;
  responseBody: unknown;
};

export type TaskLogEntry =
  | {
      kind: 'http_flow';
      id: string;
      projectId: string;
      label: string;
      flowKey: string;
      status: TaskLogStatus;
      startedAt: number;
      finishedAt?: number;
      steps: HttpStep[];
      linkedJobId?: string;
    }
  | {
      kind: 'project_job';
      id: string;
      projectId: string;
      job: ProjectJobResponse;
      httpSteps: HttpStep[];
      updatedAt: number;
      stepsById?: Record<string, JobStepResponse>;
    };

export type TaskLogExportPayload = {
  exportedAt: string;
  projectId: string;
  entries: TaskLogEntry[];
};
