import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import type { ColumnsType } from 'antd/es/table';
import { Button, Card, Input, Select, Space, Spin, Tag, Typography } from 'antd';
import { AppDataTable } from '../components/AppDataTable';
import { defaultAdminJobsApi, type ProjectJobAdminItem } from '../lib/api';
import {
  ACTIVE_JOB_STATUSES as ACTIVE_STATUSES,
  jobStatusLabel,
  jobTypeLabel,
} from '../lib/taskLog/jobLabels';
import { useAppStore } from '../store';

const JOB_STATUSES = ['pending', 'running', 'completed', 'failed', 'cancelled'] as const;

const JOB_TYPES = [
  'sand_logistics_analyze',
  'poi_analyze_all',
  'autoroad_connect',
  'import_file',
] as const;

const STATUS_LABELS: Record<string, string> = {
  pending: jobStatusLabel('pending'),
  running: jobStatusLabel('running'),
  completed: jobStatusLabel('completed'),
  failed: jobStatusLabel('failed'),
  cancelled: jobStatusLabel('cancelled'),
};
const POLL_ACTIVE_MS = 3_000;
const PAGE_SIZE = 10;

function countActiveJobs(counts: Record<string, number> | undefined): number {
  if (!counts) return 0;
  return (counts.pending ?? 0) + (counts.running ?? 0);
}

function listHasActiveJobs(items: ProjectJobAdminItem[] | undefined): boolean {
  return (items ?? []).some((j) => ACTIVE_STATUSES.has(j.status));
}

function statusTagColor(status: string): 'success' | 'warning' | 'error' | 'default' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'error';
    case 'cancelled':
      return 'default';
    default:
      return 'warning';
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
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, jobTypeFilter, projectIdFilter]);

  const listParams = useMemo(
    () => ({
      status: statusFilter ? [statusFilter] : undefined,
      job_type: jobTypeFilter || undefined,
      project_id: projectIdFilter.trim() || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    [statusFilter, jobTypeFilter, projectIdFilter, page],
  );

  const { data: health, isFetching: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['admin-jobs-health'],
    queryFn: () => defaultAdminJobsApi.adminJobsHealth(),
    refetchInterval: (query) =>
      countActiveJobs(query.state.data?.jobs_by_status) > 0 ? POLL_ACTIVE_MS : false,
    refetchOnWindowFocus: true,
  });

  const { data: list, isLoading, isFetching: listFetching, refetch: refetchList } = useQuery({
    queryKey: ['admin-jobs', listParams],
    queryFn: () => defaultAdminJobsApi.adminListJobs(listParams),
    placeholderData: keepPreviousData,
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
    mutationFn: (jobId: string) => defaultAdminJobsApi.adminCancelJob(jobId),
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
  const totalJobs = list?.total ?? 0;
  const shownCount = list?.items.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalJobs / PAGE_SIZE));
  const rangeFrom = totalJobs === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeTo = totalJobs === 0 ? 0 : rangeFrom + shownCount - 1;

  useEffect(() => {
    if (!list) return;
    if (page > totalPages) setPage(totalPages);
  }, [list, page, totalPages]);

  const jobColumns = useMemo<ColumnsType<ProjectJobAdminItem>>(
    () => [
      {
        title: 'Создана',
        key: 'created_at',
        render: (_, job) => <span className="whitespace-nowrap">{formatDt(job.created_at)}</span>,
      },
      {
        title: 'Проект',
        key: 'project',
        render: (_, job) => (
          <Link to={`/projects/${job.project_id}`}>
            {job.project_name || job.project_id?.slice(0, 8) || '—'}
          </Link>
        ),
      },
      {
        title: 'Кто',
        key: 'user',
        render: (_, job) => (
          <>
            <div>{job.user_email || '—'}</div>
            {job.user_username ? (
              <Typography.Text type="secondary" className="text-xs">
                {job.user_username}
              </Typography.Text>
            ) : null}
          </>
        ),
      },
      {
        title: 'Тип',
        key: 'job_type',
        render: (_, job) => jobTypeLabel(job.job_type),
      },
      {
        title: 'Статус',
        key: 'status',
        render: (_, job) => (
          <Tag color={statusTagColor(job.status)}>{STATUS_LABELS[job.status] ?? job.status}</Tag>
        ),
      },
      {
        title: 'Длительность',
        key: 'duration',
        render: (_, job) => (
          <span className="whitespace-nowrap">{formatDuration(job.started_at, job.finished_at)}</span>
        ),
      },
      {
        title: 'Ошибка',
        key: 'error',
        className: 'max-w-[12rem]',
        render: (_, job) => (
          <span title={job.error_message ?? undefined}>{truncate(job.error_message)}</span>
        ),
      },
      {
        title: 'Действия',
        key: 'actions',
        render: (_, job) => {
          const canCancel = job.status === 'pending' || job.status === 'running';
          return canCancel ? (
            <Button
              size="small"
              disabled={cancelMutation.isPending}
              title="Отменить задачу"
              onClick={() => cancelMutation.mutate(job.id)}
            >
              Отменить
            </Button>
          ) : (
            <Typography.Text type="secondary">—</Typography.Text>
          );
        },
      },
    ],
    [cancelMutation],
  );

  return (
    <div className="page-stack admin-jobs-page">
      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <Typography.Title level={5} className="!mb-0">
            Очередь и worker
          </Typography.Title>
          <Space>
            {autoRefreshing && (
              <Typography.Text type="secondary" className="text-xs">
                Автообновление
              </Typography.Text>
            )}
            <Button size="small" onClick={refreshAll} icon={<RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />}>
              Обновить
            </Button>
          </Space>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <Typography.Text type="secondary">Redis: </Typography.Text>
            <Typography.Text type={health?.redis_ok ? 'success' : 'danger'}>
              {health?.redis_ok ? 'доступен' : 'недоступен'}
            </Typography.Text>
            {!health?.redis_ok && health?.redis_error && (
              <Typography.Text type="secondary" className="ml-1">
                ({health.redis_error})
              </Typography.Text>
            )}
          </div>
          <div>
            <Typography.Text type="secondary">Очередь: </Typography.Text>
            {health?.queue_name ?? '—'}
            {health && !health.jobs_use_queue && (
              <Typography.Text type="secondary" className="ml-1">
                (синхронный режим)
              </Typography.Text>
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
          <Typography.Paragraph type="secondary" className="text-sm mt-3 mb-0">
            Задачи в статусе «В очереди» могут не выполняться, пока Redis и worker недоступны.
          </Typography.Paragraph>
        )}
      </Card>

      <Card className="mb-4">
        <Space wrap size="middle" align="end">
          <label className="flex flex-col gap-1 text-sm">
            <Typography.Text type="secondary">Статус</Typography.Text>
            <Select
              size="small"
              style={{ minWidth: 140 }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: '', label: 'Все' },
                ...JOB_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
              ]}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <Typography.Text type="secondary">Тип задачи</Typography.Text>
            <Select
              size="small"
              style={{ minWidth: 180 }}
              value={jobTypeFilter}
              onChange={setJobTypeFilter}
              options={[
                { value: '', label: 'Все' },
                ...JOB_TYPES.map((t) => ({ value: t, label: jobTypeLabel(t) })),
              ]}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm min-w-[12rem]">
            <Typography.Text type="secondary">ID проекта</Typography.Text>
            <Input
              size="small"
              placeholder="UUID проекта"
              value={projectIdFilter}
              onChange={(e) => setProjectIdFilter(e.target.value)}
            />
          </label>
        </Space>
      </Card>

      <Card>
        {isLoading ? (
          <Spin />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <Typography.Text type="secondary" className="text-sm">
                {totalJobs === 0
                  ? 'Показано 0 из 0'
                  : `Показано ${rangeFrom}–${rangeTo} из ${totalJobs}`}
              </Typography.Text>
              {totalJobs > PAGE_SIZE && (
                <Space>
                  <Button size="small" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Назад
                  </Button>
                  <Typography.Text type="secondary" className="text-sm tabular">
                    Страница {page} из {totalPages}
                  </Typography.Text>
                  <Button
                    size="small"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Вперёд
                  </Button>
                </Space>
              )}
            </div>
            <AppDataTable
              rowKey="id"
              columns={jobColumns}
              dataSource={list?.items ?? []}
              emptyText="Задач не найдено"
            />
          </>
        )}
      </Card>
    </div>
  );
}
