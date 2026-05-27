import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { api, type Project } from '../lib/api';
import { useAppStore } from '../store';

export function ProjectsPage() {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const qc = useQueryClient();
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const setCurrentProjectId = useAppStore((s) => s.setCurrentProjectId);

  const { data: projects = [], isLoading } = useQuery({ queryKey: ['projects'], queryFn: api.projects });

  const createMut = useMutation({
    mutationFn: () => api.createProject(name, description || undefined),
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      setCurrentProjectId(project.id);
      setShowForm(false);
      setName('');
      setDescription('');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (projectId: string) => api.deleteProject(projectId),
    onSuccess: (_data, projectId) => {
      setDeleteError(null);
      if (currentProjectId === projectId) {
        setCurrentProjectId(null);
      }
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.removeQueries({ queryKey: ['project', projectId] });
      qc.removeQueries({ queryKey: ['pois', projectId] });
      qc.removeQueries({ queryKey: ['infra', projectId] });
    },
    onError: (err: Error) => setDeleteError(err.message),
  });

  const handleDelete = (project: Project) => {
    const confirmed = window.confirm(
      `Удалить проект «${project.name}»?\n\nБудут удалены все точки интереса, объекты инфраструктуры и связанные данные. Это действие нельзя отменить.`
    );
    if (!confirmed) return;
    setDeleteError(null);
    deleteMut.mutate(project.id);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Проекты</h1>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={16} /> Новый проект
        </button>
      </div>

      {showForm && (
        <div className="card mb-4">
          <div className="form-group">
            <label>Название</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Описание</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <button type="button" className="btn btn-primary" onClick={() => createMut.mutate()} disabled={!name}>
            Создать
          </button>
        </div>
      )}

      {deleteError && (
        <div className="card mb-4 text-sm border-l-4 border-red-500" style={{ color: '#b91c1c' }}>
          {deleteError}
        </div>
      )}

      {isLoading ? (
        <p style={{ color: 'var(--text-muted)' }}>Загрузка...</p>
      ) : (
        <div className="table-wrap card p-0">
          <table className="data-table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Описание</th>
                <th>POI</th>
                <th>Статус</th>
                <th>Дата</th>
                <th className="w-28 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td>
                    <button
                      type="button"
                      className="text-blue-600 hover:underline font-medium text-left"
                      onClick={() => setCurrentProjectId(p.id)}
                    >
                      {p.name}
                    </button>
                    <Link to={`/projects/${p.id}`} className="text-xs ml-2 opacity-60 hover:underline">
                      открыть
                    </Link>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{p.description || '—'}</td>
                  <td>{p.poi_count}</td>
                  <td><span className="badge badge-muted">{p.status}</span></td>
                  <td style={{ color: 'var(--text-muted)' }}>{new Date(p.created_at).toLocaleDateString('ru')}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      className="btn btn-secondary text-sm inline-flex items-center gap-1 text-red-600 hover:text-red-700"
                      onClick={() => handleDelete(p)}
                      disabled={deleteMut.isPending}
                      title="Удалить проект"
                    >
                      <Trash2 size={14} />
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Нет проектов</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
