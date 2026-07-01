import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button, Card, Form, Input, Space, Spin } from 'antd';
import { defaultProjectsListApi, defaultProjectsWriteApi, type Project } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { normalizeProjectsList } from '../lib/normalizeProjectsList';
import { filterProjectsByQuery } from '../lib/projectDisplay';
import { ProjectsDataTable } from '../components/ProjectsDataTable';
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
                    className="projects-table-card__action-btn"
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
                <ProjectsDataTable
                  projects={filtered}
                  editable
                  canWriteProject={canWriteProject}
                  saving={saving}
                  onUpdate={(vars) => updateMut.mutate(vars)}
                  onOpenProject={openProject}
                  canDelete={(p) => canDeleteProject(currentUser?.role, currentUser?.id, p)}
                  onDelete={(p, e) => openDeleteDialog(p, e)}
                  deletePending={deleteMut.isPending}
                />
              )}
            </div>
          </Card>
        </>
      )}
      {showForm && canCreateProject ? (
        <AppModal
          title="Новый проект"
          titleId="new-project-title"
          onClose={closeCreateModal}
          size="sm"
          closeOnBackdrop={!createMut.isPending}
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
          <Form
            id="new-project-form"
            layout="vertical"
            requiredMark
            onFinish={() => {
              if (!name.trim() || createMut.isPending) return;
              createMut.mutate();
            }}
          >
            <Form.Item
              label="Название"
              htmlFor="new-project-name"
              required
              className="mb-0"
            >
              <Input
                id="new-project-name"
                value={name}
                autoFocus
                allowClear
                maxLength={255}
                placeholder="Например, Участок Восток-1"
                onChange={(e) => setName(e.target.value)}
              />
            </Form.Item>
            <Form.Item
              label="Описание"
              htmlFor="new-project-description"
              className="mb-0"
              extra="Необязательно"
            >
              <Input.TextArea
                id="new-project-description"
                value={description}
                placeholder="Регион, цель, примечания"
                autoSize={{ minRows: 3, maxRows: 6 }}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Form.Item>
          </Form>
        </AppModal>
      ) : null}
      {deleteConfirmModal}
    </div>
  );
}
