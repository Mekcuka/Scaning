import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { api, type ProjectJobAdminItem } from '../lib/api';
import { useAppStore } from '../store';

const JOB_STATUSES = ['pending', 'running', 'completed', 'failed', 'cancelled'] as const;

const JOB_TYPES = [
  'sand_logistics_analyze',
  'poi_analyze_all',
  'autoroad_connect',
  'import_file',
] as const;

const JOB_TYPE_LABELS: Record<string, string> = {
  sand_logistics_analyze: 'Логистика песка',
  poi_analyze_all: 'Анализ POI',
  autoroad_connect: 'Подключение AutoRoad',
  import_file: 'Импорт файла',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'В очереди',
  running: 'Выполняется',
  completed: 'Завершена',
  failed: 'Ошибка',
  cancelled: 'Отменена',
};

const ACTIVE_STATUSES = new Set(['pending', 'running']);
const POLL_ACTIVE_MS = 3_000;

function countActiveJobs(counts: Record<string, number> | undefined): number {
  if (!counts) return 0;
  return (counts.pending ?? 0) + (counts.running ?? 0);
}

function listHasActiveJobs(items: ProjectJobAdminItem[] | undefined): boolean {
  return (items ?? []).some((j) => ACTIVE_STATUSES.has(j.status));
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'completed':
      return 'badge badge-success';
    case 'running':
      return 'badge badge-warning';
    case 'failed':
      return 'badge badge-danger';
    case 'cancelled':
      return 'badge badge-muted';
    default:
      return 'badge badge-warning';
  }
}

function formatDt(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ru-RU');
  } catch {
    return iso;
  }
}

function formatDuration(
  started: string | null | undefined,
  finished: string | null | undefined,
): string {
  if (!started) return '—';
  const a = new Date(started).getTime();
  const b = finished ? new Date(finished).getTime() : Date.now();
  if (Number.isNaN(a) || Number.isNaN(b)) return '—';
  const sec = Math.max(0, Math.round((b - a) / 1000));
  if (sec < 60) return `${sec} с`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин`;
  return `${Math.floor(min / 60)} ч ${min % 60} мин`;
}

function truncate(s: string | null | undefined, max = 80): string {
  if (!s) return '—';
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

export function AdminJobsPage() {
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [jobTypeFilter, setJobTypeFilter] = useState<string>('');
  const [projectIdFilter, setProjectIdFilter] = useState('');

  const listParams = useMemo(
    () => ({
      status: statusFilter ? [statusFilter] : undefined,
      job_type: jobTypeFilter || undefined,
      project_id: projectIdFilter.trim() || undefined,
      limit: 50,
      offset: 0,
    }),
    [statusFilter, jobTypeFilter, projectIdFilter],
  );

  const { data: health, isFetching: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['admin-jobs-health'],
    queryFn: () => api.adminJobsHealth(),
    refetchInterval: (query) =>
      countActiveJobs(query.state.data?.jobs_by_status) > 0 ? POLL_ACTIVE_MS : false,
    refetchOnWindowFocus: true,
  });

  const { data: list, isLoading, isFetching: listFetching, refetch: refetchList } = useQuery({
    queryKey: ['admin-jobs', listParams],
    queryFn: () => api.adminListJobs(listParams),
    refetchInterval: (query) => {
      if (countActiveJobs(health?.jobs_by_status) > 0) return POLL_ACTIVE_MS;
      if (listHasActiveJobs(query.state.data?.items)) return POLL_ACTIVE_MS;
      return false;
    },
    refetchOnWindowFocus: true,
  });

  const autoRefreshing =
    countActiveJobs(health?.jobs_by_status) > 0 || listHasActiveJobs(list?.items);
  const isRefreshing = healthLoading || listFetching;

  const cancelMutation = useMutation({
    mutationFn: (jobId: string) => api.adminCancelJob(jobId),
    onSuccess: (job: ProjectJobAdminItem) => {
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['admin-jobs-health'] });
      if (job.status === 'completed') {
        pushToast('info', 'Задача уже завершена');
      } else if (job.status === 'failed') {
        pushToast('info', 'Задача уже завершилась с ошибкой');
      } else if (job.status === 'cancelled') {
        pushToast('success', 'Задача отменена');
      } else {
        pushToast('success', `Статус задачи: ${STATUS_LABELS[job.status] ?? job.status}`);
      }
    },
    onError: (err) => {
      pushToast('error', err instanceof Error ? err.message : 'Не удалось отменить задачу');
    },
  });

  const refreshAll = () => {
    void refetchHealth();
    void refetchList();
  };

  const counts = health?.jobs_by_status ?? {};

  return (
    <div className="page-stack">
      <div className="card mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-lg font-semibold">Очередь и worker</h2>
          <div className="flex items-center gap-2">
            {autoRefreshing && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Автообновление
              </span>
            )}
            <button type="button" className="btn btn-secondary btn-sm" onClick={refreshAll}>
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} aria-hidden />
              Обновить
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Redis: </span>
            <span className={health?.redis_ok ? 'text-green-700' : 'text-red-700'}>
              {health?.redis_ok ? 'доступен' : 'недоступен'}
            </span>
            {!health?.redis_ok && health?.redis_error && (
              <span className="ml-1" style={{ color: 'var(--text-muted)' }}>
                ({health.redis_error})
              </span>
            )}
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Очередь: </span>
            {health?.queue_name ?? '—'}
            {health && !health.jobs_use_queue && (
              <span className="ml-1" style={{ color: 'var(--text-muted)' }}>
                (синхронный режим)
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
          {JOB_STATUSES.map((s) => (
            <div key={s} className="text-center p-2 rounded" style={{ background: 'var(--surface-2)' }}>
              <div className="text-xl font-bold tabular">{counts[s] ?? 0}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {STATUS_LABELS[s]}
              </div>
            </div>
          ))}
        </div>
        {health && !health.redis_ok && (counts.pending ?? 0) > 0 && (
          <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>
            Задачи в статусе «В очереди» могут не выполняться, пока Redis и worker недоступны.
          </p>
        )}
      </div>

      <div className="card mb-4 flex flex-wrap gap-3 items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span style={{ color: 'var(--text-muted)' }}>Статус</span>
          <select
            className="input input-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Все</option>
            {JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span style={{ color: 'var(--text-muted)' }}>Тип задачи</span>
          <select
            className="input input-sm"
            value={jobTypeFilter}
            onChange={(e) => setJobTypeFilter(e.target.value)}
          >
            <option value="">Все</option>
            {JOB_TYPES.map((t) => (
              <option key={t} value={t}>
                {JOB_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm min-w-[12rem]">
          <span style={{ color: 'var(--text-muted)' }}>ID проекта</span>
          <input
            className="input input-sm"
            placeholder="UUID проекта"
            value={projectIdFilter}
            onChange={(e) => setProjectIdFilter(e.target.value)}
          />
        </label>
      </div>

      <div className="card overflow-x-auto">
        {isLoading ? (
          <p style={{ color: 'var(--text-muted)' }}>Загрузка...</p>
        ) : (
          <>
            <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
              Показано {list?.items.length ?? 0} из {list?.total ?? 0}
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                  <th className="text-left py-2 px-2">Создана</th>
                  <th className="text-left py-2 px-2">Проект</th>
                  <th className="text-left py-2 px-2">Кто</th>
                  <th className="text-left py-2 px-2">Тип</th>
                  <th className="text-left py-2 px-2">Статус</th>
                  <th className="text-left py-2 px-2">Длительность</th>
                  <th className="text-left py-2 px-2">Ошибка</th>
                  <th className="text-left py-2 px-2">Действия</th>
                </tr>
              </thead>
              <tbody>
                {(list?.items ?? []).map((job) => {
                  const canCancel = job.status === 'pending' || job.status === 'running';
                  return (
                    <tr key={job.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                      <td className="py-2 px-2 whitespace-nowrap">{formatDt(job.created_at)}</td>
                      <td className="py-2 px-2">
                        <Link to={`/projects/${job.project_id}`} className="text-blue-600 hover:underline">
                          {job.project_name || job.project_id?.slice(0, 8) || '—'}
                        </Link>
                      </td>
                      <td className="py-2 px-2">
                        <div>{job.user_email || '—'}</div>
                        {job.user_username && (
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {job.user_username}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-2">{JOB_TYPE_LABELS[job.job_type] ?? job.job_type}</td>
                      <td className="py-2 px-2">
                        <span className={statusBadgeClass(job.status)}>
                          {STATUS_LABELS[job.status] ?? job.status}
                        </span>
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        {formatDuration(job.started_at, job.finished_at)}
                      </td>
                      <td className="py-2 px-2 max-w-[12rem]" title={job.error_message ?? undefined}>
                        {truncate(job.error_message)}
                      </td>
                      <td className="py-2 px-2">
                        {canCancel ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={cancelMutation.isPending}
                            title="Отменить задачу"
                            onClick={() => cancelMutation.mutate(job.id)}
                          >
                            Отменить
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(list?.items.length ?? 0) === 0 && (
              <p className="py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                Задач не найдено
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
