import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import { api, type Project } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { normalizeProjectsList } from '../lib/normalizeProjectsList';
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
import { usePermissions } from '../hooks/usePermissions';
import { useDeleteProjectDialog } from '../hooks/useDeleteProjectDialog';
import { canDeleteProject } from '../lib/permissions';
import { useAppStore, useAuthStore } from '../store';
import { ProjectsTableCardHeader } from '../components/ProjectsTableCardHeader';

export function ProjectsPage() {
  const { can, isReadOnly } = usePermissions();
  const currentUser = useAuthStore((s) => s.user);
  const canWriteProject = can('write_project');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const qc = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const setCurrentProjectId = useAppStore((s) => s.setCurrentProjectId);
  const { openDeleteDialog, deleteMut, deleteConfirmModal } = useDeleteProjectDialog();
  const [projectSearch, setProjectSearch] = useState('');

  const { data: projectsData, isLoading } = useQuery({
    queryKey: queryKeys.projects,
    queryFn: api.projects,
  });
  const projects = normalizeProjectsList(projectsData);

  const filtered = useMemo(
    () => filterProjectsByQuery(projects, projectSearch),
    [projects, projectSearch],
  );

  const createMut = useMutation({
    mutationFn: () => api.createProject(name, description || undefined),
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: queryKeys.projects });
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
      qc.invalidateQueries({ queryKey: queryKeys.projects });
      pushToast('success', vars.toastMessage ?? 'Изменения сохранены');
    },
    onError: (err: Error) => pushToast('error', err.message || 'Не удалось сохранить'),
  });

  const openProject = (project: Project) => {
    setCurrentProjectId(project.id);
  };

  const saving = updateMut.isPending;

  return (
    <div className="projects-page">
      <header className="page-header">
        <h1>Проекты</h1>
        <p className="subtitle">
          {isReadOnly ? 'Просмотр опубликованных проектов' : 'Управление участками и точками интереса'}
        </p>
      </header>

      {showForm && canWriteProject && (
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
            <ProjectsTableCardHeader
              title="Таблица проектов"
              search={projectSearch}
              onSearchChange={setProjectSearch}
              actions={
                can('create_project') ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    aria-label="Новый проект"
                    onClick={() => setShowForm((v) => !v)}
                  >
                    <Plus size={14} className="inline projects-table-card__btn-icon" />
                    <span className="projects-table-card__btn-label">Новый</span>
                  </button>
                ) : null
              }
            />
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
                      <th className="col-owner">Создал</th>
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
                            readOnly={!canWriteProject}
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
                            readOnly={!canWriteProject}
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
                            disabled={saving || !canWriteProject}
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
                          className="col-owner cell-ellipsis"
                          title={p.owner_name || undefined}
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {p.owner_name?.trim() || '—'}
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
                            {canDeleteProject(currentUser?.role, currentUser?.id, p) && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm p-2"
                              onClick={(e) => openDeleteDialog(p, e)}
                              disabled={deleteMut.isPending}
                              title="Удалить проект"
                              aria-label={`Удалить ${p.name}`}
                            >
                              <Trash2 size={14} className="text-red-600" />
                            </button>
                            )}
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
      {deleteConfirmModal}
    </div>
  );
}
