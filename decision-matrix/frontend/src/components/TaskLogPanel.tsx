import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, ChevronDown, ChevronRight, Download, X } from 'lucide-react';

import { api } from '../lib/api';
import { useActiveProjectJob } from '../hooks/useActiveProjectJob';
import {
  ACTIVE_JOB_STATUSES,
  jobStatusLabel,
  jobTypeLabel,
} from '../lib/taskLog/jobLabels';
import {
  buildExportPayload,
  downloadTaskLogJson,
  exportEntryFilename,
} from '../lib/taskLog/export';
import { useTaskLogStore } from '../lib/taskLog/store';
import type { TaskLogEntry } from '../lib/taskLog/types';
import type { HttpStep } from '../lib/taskLog/types';

function formatTime(ts: number | string | null | undefined): string {
  if (ts == null) return '—';
  try {
    const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
    return d.toLocaleString('ru-RU');
  } catch {
    return String(ts);
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'completed':
      return 'badge badge-success';
    case 'running':
    case 'pending':
      return 'badge badge-warning';
    case 'failed':
      return 'badge badge-danger';
    case 'cancelled':
      return 'badge badge-muted';
    default:
      return 'badge badge-muted';
  }
}

function JsonBlock({ value }: { value: unknown }) {
  const text =
    value == null
      ? '—'
      : typeof value === 'string'
        ? value
        : JSON.stringify(value, null, 2);
  return (
    <pre className="task-log-json" tabIndex={0}>
      {text}
    </pre>
  );
}

function HttpStepsBlock({ steps }: { steps: HttpStep[] }) {
  const [openId, setOpenId] = useState<string | null>(steps[0]?.id ?? null);
  if (!steps.length) return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Нет HTTP-шагов</p>;
  return (
    <div className="task-log-steps">
      {steps.map((step) => {
        const expanded = openId === step.id;
        return (
          <div key={step.id} className="task-log-step">
            <button
              type="button"
              className="task-log-step-head"
              onClick={() => setOpenId(expanded ? null : step.id)}
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span className="font-mono text-xs">
                {step.method} {step.status}
              </span>
              <span className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                {step.path}
              </span>
            </button>
            {expanded && (
              <div className="task-log-step-body">
                <div className="task-log-step-section">
                  <span className="task-log-step-label">Запрос</span>
                  <JsonBlock value={step.requestBody} />
                </div>
                <div className="task-log-step-section">
                  <span className="task-log-step-label">Ответ</span>
                  <JsonBlock value={step.responseBody} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function entryTitle(entry: TaskLogEntry): string {
  if (entry.kind === 'http_flow') return entry.label;
  return jobTypeLabel(entry.job.job_type);
}

function entryStatus(entry: TaskLogEntry): string {
  if (entry.kind === 'http_flow') return entry.status;
  return entry.job.status;
}

function EntryCard({
  entry,
  projectId,
  onExport,
  onJobCancelled,
}: {
  entry: TaskLogEntry;
  projectId: string;
  onExport: (entry: TaskLogEntry) => void;
  onJobCancelled: () => void;
}) {
  const [expanded, setExpanded] = useState(entry.kind === 'project_job' && ACTIVE_JOB_STATUSES.has(entryStatus(entry)));
  const cancelMut = useMutation({
    mutationFn: () => {
      if (entry.kind !== 'project_job') return Promise.reject(new Error('Not a job'));
      return api.cancelProjectJob(projectId, entry.id);
    },
    onSuccess: onJobCancelled,
  });

  const canCancel =
    entry.kind === 'project_job' && ACTIVE_JOB_STATUSES.has(entry.job.status);

  return (
    <article className="task-log-entry">
      <div className="task-log-entry-head">
        <button
          type="button"
          className="task-log-entry-toggle"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span className="task-log-entry-title">{entryTitle(entry)}</span>
          <span className={statusBadgeClass(entryStatus(entry))}>{jobStatusLabel(entryStatus(entry))}</span>
        </button>
        <div className="task-log-entry-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm p-1"
            title="Скачать JSON"
            onClick={() => onExport(entry)}
          >
            <Download size={14} />
          </button>
          {canCancel && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={cancelMut.isPending}
              onClick={() => cancelMut.mutate()}
            >
              Отменить
            </button>
          )}
        </div>
      </div>
      <div className="task-log-entry-meta text-xs" style={{ color: 'var(--text-muted)' }}>
        {entry.kind === 'http_flow' ? (
          <>
            {formatTime(entry.startedAt)}
            {entry.finishedAt ? ` — ${formatTime(entry.finishedAt)}` : ''}
            {entry.steps.length > 0 ? ` · ${entry.steps.length} запрос(ов)` : ''}
          </>
        ) : (
          <>
            {formatTime(entry.job.created_at)}
            {entry.job.finished_at ? ` — ${formatTime(entry.job.finished_at)}` : ''}
          </>
        )}
      </div>
      {expanded && (
        <div className="task-log-entry-body">
          {entry.kind === 'http_flow' && <HttpStepsBlock steps={entry.steps} />}
          {entry.kind === 'project_job' && (
            <>
              {entry.httpSteps.length > 0 && (
                <div className="mb-3">
                  <span className="task-log-step-label">HTTP до постановки в очередь</span>
                  <HttpStepsBlock steps={entry.httpSteps} />
                </div>
              )}
              <div className="task-log-step-section">
                <span className="task-log-step-label">Payload (отправлено)</span>
                <JsonBlock value={entry.job.payload} />
              </div>
              <div className="task-log-step-section">
                <span className="task-log-step-label">Result (принято)</span>
                <JsonBlock value={entry.job.result ?? entry.job.error_message} />
              </div>
            </>
          )}
        </div>
      )}
    </article>
  );
}

export function TaskLogPanel({ projectId }: { projectId: string | null }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const byProject = useTaskLogStore((s) => s.byProject);
  const hydrateProject = useTaskLogStore((s) => s.hydrateProject);
  const mergeJobsFromApi = useTaskLogStore((s) => s.mergeJobsFromApi);
  const storeEntries = projectId ? (byProject[projectId] ?? []) : [];

  useEffect(() => {
    if (projectId) hydrateProject(projectId);
  }, [projectId, hydrateProject]);
  const { activeProjectJob } = useActiveProjectJob(projectId);

  const { data: jobsList } = useQuery({
    queryKey: ['projectJobs', projectId],
    queryFn: () => api.listProjectJobs(projectId!, { limit: 30 }),
    enabled: Boolean(projectId) && open,
    refetchInterval: open ? 5000 : false,
  });

  useEffect(() => {
    if (jobsList?.items && projectId) {
      mergeJobsFromApi(projectId, jobsList.items);
    }
  }, [jobsList, projectId, mergeJobsFromApi]);

  const mergedEntries = useMemo(() => {
    if (!projectId) return [];
    const byId = new Map<string, TaskLogEntry>();
    for (const e of storeEntries) byId.set(e.id, e);
    if (activeProjectJob) {
      const existing = byId.get(activeProjectJob.id);
      byId.set(activeProjectJob.id, {
        kind: 'project_job',
        id: activeProjectJob.id,
        projectId,
        job: activeProjectJob,
        httpSteps: existing?.kind === 'project_job' ? existing.httpSteps : [],
        updatedAt: Date.now(),
      });
    }
    return [...byId.values()].sort((a, b) => {
      const ta =
        a.kind === 'http_flow'
          ? a.startedAt
          : new Date(a.job.created_at ?? 0).getTime();
      const tb =
        b.kind === 'http_flow'
          ? b.startedAt
          : new Date(b.job.created_at ?? 0).getTime();
      return tb - ta;
    });
  }, [projectId, storeEntries, activeProjectJob]);

  const runningCount = useMemo(
    () =>
      mergedEntries.filter((e) => {
        const st = entryStatus(e);
        return st === 'running' || st === 'pending';
      }).length,
    [mergedEntries],
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent) => {
      const t = ev.target as Node;
      if (anchorRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const handleExportEntry = (entry: TaskLogEntry) => {
    if (!projectId) return;
    downloadTaskLogJson(exportEntryFilename(entry), buildExportPayload(projectId, [entry]));
  };

  const handleExportAll = () => {
    if (!projectId) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadTaskLogJson(`task-log-${projectId.slice(0, 8)}-${stamp}.json`, buildExportPayload(projectId, mergedEntries));
  };

  if (!projectId) return null;

  return (
    <div className="task-log-anchor" ref={anchorRef}>
      <button
        type="button"
        className="btn btn-ghost p-2 shrink-0 relative"
        title="Журнал задач"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Activity size={18} />
        {runningCount > 0 && <span className="task-log-badge">{runningCount}</span>}
      </button>
      {open && (
        <div className="task-log-panel" ref={panelRef} role="dialog" aria-label="Журнал задач">
          <div className="task-log-panel-head">
            <h2 className="task-log-panel-title">Журнал задач</h2>
            <button type="button" className="btn btn-ghost p-1" onClick={() => setOpen(false)} aria-label="Закрыть">
              <X size={18} />
            </button>
          </div>
          <div className="task-log-panel-body">
            {mergedEntries.length === 0 ? (
              <p className="text-sm p-4" style={{ color: 'var(--text-muted)' }}>
                Запущенных расчётов пока нет. Запустите построение сети, импорт или анализ — здесь появятся JSON
                запросов и ответов.
              </p>
            ) : (
              mergedEntries.map((entry) => (
                <EntryCard
                  key={`${entry.kind}-${entry.id}`}
                  entry={entry}
                  projectId={projectId}
                  onExport={handleExportEntry}
                  onJobCancelled={() => {
                    void queryClient.invalidateQueries({ queryKey: ['activeJob', projectId] });
                    void queryClient.invalidateQueries({ queryKey: ['projectJobs', projectId] });
                  }}
                />
              ))
            )}
          </div>
          <div className="task-log-panel-foot">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={mergedEntries.length === 0}
              onClick={handleExportAll}
            >
              <Download size={14} className="mr-1 inline" />
              Экспорт всего
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
