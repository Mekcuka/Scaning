import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from 'antd';
import { AppSelect } from '../components/AppSelect';
import { defaultAdminUsersApi } from '../lib/api';
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

  return (
    <div className="page-stack">
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
          <table className="admin-users-table w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                <th className="text-left py-2 px-2">Email</th>
                <th className="text-left py-2 px-2">Имя</th>
                <th className="text-left py-2 px-2 admin-users-table__col-date">Зарегистрирован</th>
                <th className="text-left py-2 px-2 admin-users-table__col-date">Последний вход</th>
                <th className="text-right py-2 px-2 admin-users-table__col-fit">Проектов</th>
                <th className="text-left py-2 px-2 admin-users-table__col-fit">Роль</th>
                <th className="text-left py-2 px-2 admin-users-table__col-fit">Статус</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                  <td className="py-2 px-2">{u.email}</td>
                  <td className="py-2 px-2">{u.username}</td>
                  <td className="py-2 px-2 admin-users-table__col-date">{formatAdminDateTime(u.created_at)}</td>
                  <td className="py-2 px-2 admin-users-table__col-date">{formatAdminDateTime(u.last_login_at)}</td>
                  <td className="py-2 px-2 text-right tabular font-medium admin-users-table__col-fit">
                    {u.project_count}
                  </td>
                  <td className="py-2 px-2 admin-users-table__col-fit">
                    <AppSelect
                      variant="sm"
                      className="admin-users-table__role-select"
                      value={u.role}
                      onChange={(role) => updateMutation.mutate({ id: u.id, role })}
                      options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
                    />
                  </td>
                  <td className="py-2 px-2 admin-users-table__col-fit">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={u.is_active}
                        onChange={(e) =>
                          updateMutation.mutate({ id: u.id, is_active: e.target.checked })
                        }
                      />
                      <span>{u.is_active ? 'Активен' : 'Отключён'}</span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
