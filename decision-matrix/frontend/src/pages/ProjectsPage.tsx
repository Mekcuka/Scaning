import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Card, Form, Input, Space, Spin } from 'antd';
import { defaultProjectsListApi, defaultProjectsWriteApi, type Project } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { normalizeProjectsList } from '../lib/normalizeProjectsList';
import {
  ellipsisText,
  filterProjectsByQuery,
  formatProjectDate,
  PROJECT_TABLE_DESC_MAX,
  PROJECT_TABLE_NAME_MAX,
} from '../lib/projectDisplay';
import { InlineTableEdit } from '../components/InlineTableEdit';
import { ProjectStatusSelect } from '../components/ProjectStatusSelect';
import { usePermissions } from '../hooks/usePermissions';
import { useDeleteProjectDialog } from '../hooks/useDeleteProjectDialog';
import { canDeleteProject } from '../lib/permissions';
import { useAppStore, useAuthStore } from '../store';
import { AppModal } from '../components/AppModal';
import { ProjectsTableCardHeader } from '../components/ProjectsTableCardHeader';
import { usePageHeader } from '../components/layout/pageHeaderContext';

export function ProjectsPage() {
  const { can, isReadOnly } = usePermissions();
  const currentUser = useAuthStore((s) => s.user);
  const canCreateProject = can('create_project');
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
    queryFn: defaultProjectsListApi.projects,
  });
  const projects = normalizeProjectsList(projectsData);

  const filtered = useMemo(
    () => filterProjectsByQuery(projects, projectSearch),
    [projects, projectSearch],
  );

  const createMut = useMutation({
    mutationFn: () => defaultProjectsWriteApi.createProject(name, description || undefined),
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
      defaultProjectsWriteApi.updateProject(id, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.projects });
      pushToast('success', vars.toastMessage ?? 'Изменения сохранены');
    },
    onError: (err: Error) => pushToast('error', err.message || 'Не удалось сохранить'),
  });

  const openProject = (project: Project) => {
    setCurrentProjectId(project.id);
  };

  const closeCreateModal = () => {
    if (createMut.isPending) return;
    setShowForm(false);
    setName('');
    setDescription('');
  };

  const saving = updateMut.isPending;

  const projectsSubtitle = isReadOnly
    ? 'Просмотр опубликованных проектов'
    : 'Управление участками и точками интереса';
  usePageHeader(
    { title: 'Проекты', subtitle: projectsSubtitle },
    [projectsSubtitle],
  );

  return (
    <div className="projects-page">
      {isLoading ? (
        <Spin />
      ) : (
        <>
          <Card className="projects-table-card" styles={{ body: { padding: 0 } }}>
            <ProjectsTableCardHeader
              title="Таблица проектов"
              search={projectSearch}
              onSearchChange={setProjectSearch}
              actions={
                canCreateProject ? (
                  <Button
                    type="primary"
                    size="small"
                    aria-label="Новый проект"
                    icon={<Plus size={14} className="projects-table-card__btn-icon" />}
                    onClick={() => setShowForm(true)}
                  >
                    <span className="projects-table-card__btn-label">Новый</span>
                  </Button>
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
                        <td className="col-actions">
                          <div className="projects-table-actions">
                            <Link to={`/projects/${p.id}`} onClick={() => openProject(p)}>
                              <Button size="small">Открыть</Button>
                            </Link>
                            {canDeleteProject(currentUser?.role, currentUser?.id, p) && (
                              <Button
                                size="small"
                                icon={<Trash2 size={14} className="text-red-600" />}
                                onClick={(e) => openDeleteDialog(p, e)}
                                disabled={deleteMut.isPending}
                                title="Удалить проект"
                                aria-label={`Удалить ${p.name}`}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </>
      )}
      {showForm && canCreateProject ? (
        <AppModal
          title="Новый проект"
          onClose={closeCreateModal}
          size="sm"
          footer={
            <Space>
              <Button onClick={closeCreateModal} disabled={createMut.isPending}>
                Отмена
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                form="new-project-form"
                disabled={!name.trim()}
                loading={createMut.isPending}
              >
                {createMut.isPending ? 'Создание…' : 'Создать'}
              </Button>
            </Space>
          }
        >
          <form
            id="new-project-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim() || createMut.isPending) return;
              createMut.mutate();
            }}
          >
            <Form.Item label="Название" htmlFor="new-project-name" className="mb-3">
              <Input
                id="new-project-name"
                value={name}
                required
                onChange={(e) => setName(e.target.value)}
              />
            </Form.Item>
            <Form.Item label="Описание" htmlFor="new-project-description" className="mb-0">
              <Input.TextArea
                id="new-project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </Form.Item>
          </form>
        </AppModal>
      ) : null}
      {deleteConfirmModal}
    </div>
  );
}
