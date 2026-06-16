export interface ProjectJobCreateResponse {
  job_id: string;
  job_type: string;
  status: string;
}

export interface ProjectJobResponse {
  id: string;
  project_id: string;
  user_id?: string | null;
  job_type: string;
  status: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  error_message?: string | null;
  progress?: number | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at?: string | null;
  steps_total?: number | null;
  steps_completed?: number | null;
  current_step?: { seq: number; step_code: string; title: string } | null;
}

export interface JobStepResponse {
  id: string;
  seq: number;
  step_code: string;
  title: string;
  status: string;
  started_at?: string | null;
  finished_at?: string | null;
  duration_ms?: number | null;
  detail?: Record<string, unknown> | null;
  error_message?: string | null;
}

export interface JobStepListResponse {
  job_id: string;
  project_id: string;
  steps: JobStepResponse[];
  progress?: number | null;
  steps_total: number;
  steps_completed: number;
}

export interface ProjectJobListResponse {
  items: ProjectJobResponse[];
  total: number;
  limit: number;
}

export interface ProjectJobAdminItem extends ProjectJobResponse {
  user_email: string;
  user_username: string;
  project_name: string;
}

export interface ProjectJobAdminListResponse {
  items: ProjectJobAdminItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminJobsHealthResponse {
  redis_ok: boolean;
  redis_error?: string | null;
  queue_name: string;
  jobs_use_queue: boolean;
  jobs_by_status: Record<string, number>;
  active_jobs: Array<{
    id: string;
    job_type: string;
    status: string;
    project_id: string;
    project_name?: string;
    created_at?: string | null;
  }>;
}
