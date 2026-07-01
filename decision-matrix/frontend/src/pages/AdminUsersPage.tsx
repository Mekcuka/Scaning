import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import { Card } from 'antd';
import { AppSelect } from '../components/AppSelect';
import { AppDataTable } from '../components/AppDataTable';
import { defaultAdminUsersApi } from '../lib/api';
import type { AdminUserRow } from '../lib/api/adminApi';
import { ROLE_LABELS, type UserRole } from '../lib/permissions';
import { useAppStore, useAuthStore } from '../store';

const ROLES: UserRole[] = ['admin', 'analyst', 'data_manager', 'viewer'];

function formatAdminDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('ru-RU');
}

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const pushToast = useAppStore((s) => s.pushToast);
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => defaultAdminUsersApi.adminUsers(),
  });
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => defaultAdminUsersApi.adminStats(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, role, is_active }: { id: string; role?: string; is_active?: boolean }) =>
      defaultAdminUsersApi.updateAdminUser(id, { role, is_active }),
    onSuccess: async (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      if (vars.id === currentUser?.id) {
        await refreshUser();
        pushToast('info', 'Ваша роль обновлена. Меню пересчитано.');
      } else if (vars.role) {
        pushToast('success', 'Роль пользователя сохранена');
      }
    },
    onError: (err) => {
      pushToast('error', err instanceof Error ? err.message : 'Не удалось обновить пользователя');
    },
  });

  const columns = useMemo<ColumnsType<AdminUserRow>>(
    () => [
      { title: 'Email', dataIndex: 'email', key: 'email' },
      { title: 'Имя', dataIndex: 'username', key: 'username' },
      {
        title: 'Зарегистрирован',
        key: 'created_at',
        className: 'admin-users-table__col-date',
        render: (_, u) => formatAdminDateTime(u.created_at),
      },
      {
        title: 'Последний вход',
        key: 'last_login_at',
        className: 'admin-users-table__col-date',
        render: (_, u) => formatAdminDateTime(u.last_login_at),
      },
      {
        title: 'Проектов',
        dataIndex: 'project_count',
        key: 'project_count',
        align: 'right',
        className: 'admin-users-table__col-fit tabular font-medium',
      },
      {
        title: 'Роль',
        key: 'role',
        className: 'admin-users-table__col-fit',
        render: (_, u) => (
          <AppSelect
            variant="sm"
            className="admin-users-table__role-select"
            value={u.role}
            onChange={(role) => updateMutation.mutate({ id: u.id, role })}
            options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
          />
        ),
      },
      {
        title: 'Статус',
        key: 'status',
        className: 'admin-users-table__col-fit',
        render: (_, u) => (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={u.is_active}
              onChange={(e) => updateMutation.mutate({ id: u.id, is_active: e.target.checked })}
            />
            <span>{u.is_active ? 'Активен' : 'Отключён'}</span>
          </label>
        ),
      },
    ],
    [updateMutation],
  );

  return (
    <div className="page-stack admin-users-page">
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            ['Пользователи', stats.users],
            ['Проекты', stats.projects],
            ['POI', stats.pois],
          ].map(([label, value]) => (
            <Card key={label as string} size="small" className="text-center">
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {label}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card size="small" className="overflow-x-auto">
        {isLoading ? (
          <p style={{ color: 'var(--text-muted)' }}>Загрузка...</p>
        ) : (
          <AppDataTable
            className="admin-users-table"
            rowKey="id"
            columns={columns}
            dataSource={users}
            emptyText="Нет пользователей"
          />
        )}
      </Card>
    </div>
  );
}
