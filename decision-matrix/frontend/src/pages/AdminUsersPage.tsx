import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield } from 'lucide-react';
import { api } from '../lib/api';
import { ROLE_LABELS, type UserRole } from '../lib/permissions';
import { useAppStore, useAuthStore } from '../store';

const ROLES: UserRole[] = ['admin', 'analyst', 'data_manager', 'viewer'];

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const pushToast = useAppStore((s) => s.pushToast);
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.adminUsers(),
  });
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.adminStats(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, role, is_active }: { id: string; role?: string; is_active?: boolean }) =>
      api.updateAdminUser(id, { role, is_active }),
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
      <div className="flex items-center gap-3 mb-6">
        <Shield size={24} className="text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold">Администрирование</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Управление пользователями и ролями
          </p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            ['Пользователи', stats.users],
            ['Проекты', stats.projects],
            ['POI', stats.pois],
          ].map(([label, value]) => (
            <div key={label as string} className="card text-center">
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card overflow-x-auto">
        {isLoading ? (
          <p style={{ color: 'var(--text-muted)' }}>Загрузка...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                <th className="text-left py-2 px-2">Email</th>
                <th className="text-left py-2 px-2">Имя</th>
                <th className="text-right py-2 px-2">Проектов</th>
                <th className="text-left py-2 px-2">Роль</th>
                <th className="text-left py-2 px-2">Статус</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                  <td className="py-2 px-2">{u.email}</td>
                  <td className="py-2 px-2">{u.username}</td>
                  <td className="py-2 px-2 text-right tabular font-medium">
                    {u.project_count}
                  </td>
                  <td className="py-2 px-2">
                    <select
                      className="input input-sm"
                      value={u.role}
                      onChange={(e) =>
                        updateMutation.mutate({ id: u.id, role: e.target.value })
                      }
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-2">
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
      </div>
    </div>
  );
}
