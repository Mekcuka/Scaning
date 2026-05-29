import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import { api, type Project } from '../lib/api';
import {
  ellipsisText,
  filterProjectsByQuery,
  formatProjectDate,
  PROJECT_TABLE_DESC_MAX,
  PROJECT_TABLE_NAME_MAX,
  projectStatus,
  sparklineBars,
} from '../lib/projectDisplay';
import { InlineTableEdit } from '../components/InlineTableEdit';
import { ProjectStatusSelect } from '../components/ProjectStatusSelect';
import { useAppStore } from '../store';
import { useDashboardOutlet } from '../components/layout/AppLayout';

export function ProjectsPage() {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const qc = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const setCurrentProjectId = useAppStore((s) => s.setCurrentProjectId);
  const { projectSearch = '' } = useDashboardOutlet();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: api.projects,
  });

  const filtered = useMemo(
    () => filterProjectsByQuery(projects, projectSearch),
    [projects, projectSearch],
  );

  const createMut = useMutation({
    mutationFn: () => api.createProject(name, description || undefined),
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      setCurrentProjectId(project.id);
      setShowForm(false);
      setName('');
      setDescription('');
      pushToast('success', `Проект «${project.name}» создан`);
    },
    onError: (err: Error) => pushToast('error', err.message || 'Не удалось создать проект'),
  });

  type ProjectUpdateVars = {
    id: string;
    name?: string;
    description?: string;
    status?: string;
    toastMessage?: string;
  };

  const updateMut = useMutation({
    mutationFn: ({ id, toastMessage: _toast, ...data }: ProjectUpdateVars) =>
      api.updateProject(id, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      pushToast('success', vars.toastMessage ?? 'Изменения сохранены');
    },
    onError: (err: Error) => pushToast('error', err.message || 'Не удалось сохранить'),
  });

  const deleteMut = useMutation({
    mutationFn: (projectId: string) => api.deleteProject(projectId),
    onSuccess: (_data, projectId) => {
      if (currentProjectId === projectId) {
        setCurrentProjectId(null);
      }
      qc.invalidateQueries({ queryKey: ['projects'] });
      pushToast('success', 'Проект удалён');
      qc.removeQueries({ queryKey: ['project', projectId] });
      qc.removeQueries({ queryKey: ['pois', projectId] });
      qc.removeQueries({ queryKey: ['infra', projectId] });
    },
    onError: (err: Error) => pushToast('error', err.message || 'Не удалось удалить проект'),
  });

  const handleDelete = (project: Project, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const confirmed = window.confirm(
      `Удалить проект «${project.name}»?\n\nБудут удалены все точки интереса, объекты инфраструктуры и связанные данные. Это действие нельзя отменить.`,
    );
    if (!confirmed) return;
    deleteMut.mutate(project.id);
  };

  const openProject = (project: Project) => {
    setCurrentProjectId(project.id);
  };

  const saving = updateMut.isPending;

  return (
    <div className="projects-page">
      <header className="page-header">
        <h1>Проекты</h1>
        <p className="subtitle">Управление участками и точками интереса</p>
      </header>

      {showForm && (
        <div className="card mb-4">
          <h2 className="text-base font-semibold mb-3">Новый проект</h2>
          <div className="form-group">
            <label>Название</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Описание</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => createMut.mutate()}
              disabled={!name.trim() || createMut.isPending}
            >
              {createMut.isPending ? 'Создание…' : 'Создать'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p style={{ color: 'var(--text-muted)' }}>Загрузка…</p>
      ) : (
        <>
          {filtered.length > 0 && (
            <div className="projects-grid mb-6">
              {filtered.map((p) => {
                const st = projectStatus(p.status);
                return (
                  <Link
                    key={p.id}
                    to={`/projects/${p.id}`}
                    className="project-card"
                    onClick={() => openProject(p)}
                  >
                    <h3>{p.name}</h3>
                    <p>{p.description || 'Без описания'}</p>
                    <div className="project-card-meta">
                      <span className="flex items-center gap-1">
                        <MapPin size={14} />
                        {p.poi_count} POI
                      </span>
                      <span className={`status ${st.className}`}>{st.label}</span>
                    </div>
                    <div className="sparkline">{sparklineBars(p.id)}</div>
                    <div
                      className="tabular text-sm font-semibold mt-2"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      —
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="card card--flush projects-table-card">
            <div className="card-header projects-table-card__header">
              <h2 className="projects-table-card__title">Таблица проектов</h2>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                aria-label="Новый проект"
                onClick={() => setShowForm((v) => !v)}
              >
                <Plus size={14} className="inline projects-table-card__btn-icon" />
                <span className="projects-table-card__btn-label">Новый</span>
              </button>
            </div>
            <div className="table-wrap">
              {filtered.length === 0 ? (
                <p className="p-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                  {projects.length === 0
                    ? 'Нет проектов. Нажмите «Новый», чтобы создать первый.'
                    : 'Ничего не найдено по запросу поиска.'}
                </p>
              ) : (
                <table className="data-table data-table--projects">
                  <thead>
                    <tr>
                      <th className="col-name">Название</th>
                      <th className="col-desc">Описание</th>
                      <th className="col-center col-poi">POI</th>
                      <th className="col-center col-status">Статус</th>
                      <th className="col-center col-date">Дата</th>
                      <th className="col-center col-cost">Стоимость</th>
                      <th className="col-actions" aria-label="Действия" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr key={p.id}>
                        <td className="cell-ellipsis">
                          <InlineTableEdit
                            value={p.name}
                            displayText={ellipsisText(p.name, PROJECT_TABLE_NAME_MAX)}
                            title={p.name}
                            placeholder="Название проекта"
                            saving={saving}
                            linkTo={`/projects/${p.id}`}
                            onLinkClick={() => openProject(p)}
                            onSave={(name) =>
                              updateMut.mutate({
                                id: p.id,
                                name,
                                toastMessage: 'Название проекта сохранено',
                              })
                            }
                          />
                        </td>
                        <td className="cell-ellipsis" style={{ color: 'var(--text-muted)' }}>
                          <InlineTableEdit
                            value={p.description ?? ''}
                            displayText={ellipsisText(p.description, PROJECT_TABLE_DESC_MAX)}
                            title={p.description?.trim() || undefined}
                            placeholder="Описание проекта"
                            multiline
                            saving={saving}
                            onSave={(description) =>
                              updateMut.mutate({
                                id: p.id,
                                description: description || '',
                                toastMessage: 'Описание проекта сохранено',
                              })
                            }
                          />
                        </td>
                        <td className="tabular col-center col-poi">{p.poi_count}</td>
                        <td className="col-center col-status">
                          <ProjectStatusSelect
                            value={p.status}
                            disabled={saving}
                            onChange={(status) =>
                              updateMut.mutate({
                                id: p.id,
                                status,
                                toastMessage: 'Статус проекта обновлён',
                              })
                            }
                          />
                        </td>
                        <td
                          className="tabular col-center col-date"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {formatProjectDate(p.created_at)}
                        </td>
                        <td
                          className="tabular col-center col-cost"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          —
                        </td>
                        <td className="col-actions">
                          <div className="projects-table-actions">
                            <Link
                              to={`/projects/${p.id}`}
                              className="btn btn-secondary btn-sm"
                              onClick={() => openProject(p)}
                            >
                              Открыть
                            </Link>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm p-2"
                              onClick={(e) => handleDelete(p, e)}
                              disabled={deleteMut.isPending}
                              title="Удалить проект"
                              aria-label={`Удалить ${p.name}`}
                            >
                              <Trash2 size={14} className="text-red-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
