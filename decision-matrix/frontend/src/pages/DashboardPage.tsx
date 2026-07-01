import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button, Card } from 'antd';
import { ProjectLink } from '../components/ProjectLink';
import { FileOutput, Grid3X3, Map, Plus } from 'lucide-react';
import { defaultProjectsListApi, type Project } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { normalizeProjectsList } from '../lib/normalizeProjectsList';
import { ProjectsDataTable } from '../components/ProjectsDataTable';
import {
  filterProjectsByQuery,
  filterProjectsOwnedByUser,
} from '../lib/projectDisplay';
import { useAuthStore, useAppStore } from '../store';
import { ProjectsTableCardHeader } from '../components/ProjectsTableCardHeader';
import { PageSkeleton } from '../components/PageSkeleton';
import { ErrorPanel } from '../components/ErrorPanel';
import { useDeleteProjectDialog } from '../hooks/useDeleteProjectDialog';
import { canDeleteProject } from '../lib/permissions';
import { usePageHeader } from '../components/layout/pageHeaderContext';

function displayName(username: string | undefined): string {
  if (!username) return 'Engineer';
  const part = username.trim().split(/\s+/)[0];
  return part || 'Engineer';
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const setCurrentProjectId = useAppStore((s) => s.setCurrentProjectId);
  const { openDeleteDialog, deleteMut, deleteConfirmModal } = useDeleteProjectDialog();
  const [projectSearch, setProjectSearch] = useState('');

  const openProject = (project: Project) => {
    setCurrentProjectId(project.id);
  };
  const {
    data: projectsData,
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: queryKeys.projects, queryFn: defaultProjectsListApi.projects });
  const projects = normalizeProjectsList(projectsData);
  const myProjects = useMemo(
    () => filterProjectsOwnedByUser(projects, user?.id),
    [projects, user?.id],
  );

  const filtered = useMemo(
    () => filterProjectsByQuery(myProjects, projectSearch),
    [myProjects, projectSearch],
  );

  const welcomeTitle = `Добро пожаловать, ${displayName(user?.username)}`;
  usePageHeader(
    {
      title: welcomeTitle,
      subtitle: 'Оценка инфраструктуры и сравнение точек интереса',
    },
    [welcomeTitle],
  );

  const totalPoi = myProjects.reduce((s, p) => s + p.poi_count, 0);
  const exceedCount = 0;

  if (isLoading) return <PageSkeleton lines={6} />;
  if (isError) {
    return (
      <ErrorPanel message="Не удалось загрузить проекты" onRetry={() => void refetch()} />
    );
  }

  return (
    <div className="dashboard-page">
      <div className="stats-row">
        <div className="stat-box">
          <div className="value tabular">{myProjects.length}</div>
          <div className="label">Проектов</div>
        </div>
        <div className="stat-box">
          <div className="value tabular">{totalPoi}</div>
          <div className="label">Точек интереса</div>
        </div>
        <div className={`stat-box${exceedCount > 0 ? ' warning' : ''}`}>
          <div className="value tabular">{exceedCount}</div>
          <div className="label">Превышений лимита</div>
        </div>
      </div>

      <div className="quick-actions">
        <Link to="/projects" className="quick-card">
          <div className="icon-wrap">
            <Plus size={20} />
          </div>
          <strong>Новый проект</strong>
        </Link>
        <ProjectLink to="/map" className="quick-card">
          <div className="icon-wrap">
            <Map size={20} />
          </div>
          <strong>Открыть карту</strong>
        </ProjectLink>
        <ProjectLink to="/matrix" className="quick-card">
          <div className="icon-wrap">
            <Grid3X3 size={20} />
          </div>
          <strong>Матрица</strong>
        </ProjectLink>
        <ProjectLink to="/report" className="quick-card">
          <div className="icon-wrap">
            <FileOutput size={20} />
          </div>
          <strong>Отчёт</strong>
        </ProjectLink>
      </div>

      <Card className="projects-table-card" styles={{ body: { padding: 0 } }}>
        <ProjectsTableCardHeader
          title="Мои проекты"
          search={projectSearch}
          onSearchChange={setProjectSearch}
          actions={
            <Link to="/projects">
              <Button type="primary" size="small" className="projects-table-card__action-btn">
                Список
              </Button>
            </Link>
          }
        />
        <div className="table-wrap">
          {filtered.length === 0 ? (
            <p className="p-6 text-sm" style={{ color: 'var(--text-muted)' }}>
              {myProjects.length === 0
                ? 'У вас пока нет проектов. Создайте первый через «Новый проект».'
                : 'Ничего не найдено по запросу поиска.'}
            </p>
          ) : (
            <ProjectsDataTable
              projects={filtered}
              onOpenProject={openProject}
              canDelete={(p) => canDeleteProject(user?.role, user?.id, p)}
              onDelete={(p, e) => openDeleteDialog(p, e)}
              deletePending={deleteMut.isPending}
              emptyText={
                myProjects.length === 0
                  ? 'У вас пока нет проектов. Создайте первый через «Новый проект».'
                  : 'Ничего не найдено по запросу поиска.'
              }
            />
          )}
        </div>
      </Card>
      {deleteConfirmModal}
    </div>
  );
}
