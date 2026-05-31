import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileOutput, Grid3X3, MapPin, Map, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import {
  filterProjectsByQuery,
  formatProjectDate,
  projectStatus,
  sparklineBars,
} from '../lib/projectDisplay';
import { useAuthStore } from '../store';
import { ProjectsTableCardHeader } from '../components/ProjectsTableCardHeader';
import { PageSkeleton } from '../components/PageSkeleton';
import { ErrorPanel } from '../components/ErrorPanel';

function displayName(username: string | undefined): string {
  if (!username) return 'Engineer';
  const part = username.trim().split(/\s+/)[0];
  return part || 'Engineer';
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [projectSearch, setProjectSearch] = useState('');
  const {
    data: projects = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: queryKeys.projects, queryFn: api.projects });

  const filtered = useMemo(
    () => filterProjectsByQuery(projects, projectSearch),
    [projects, projectSearch],
  );

  const totalPoi = projects.reduce((s, p) => s + p.poi_count, 0);
  const exceedCount = 0;

  if (isLoading) return <PageSkeleton lines={6} />;
  if (isError) {
    return (
      <ErrorPanel message="Не удалось загрузить проекты" onRetry={() => void refetch()} />
    );
  }

  return (
    <div className="dashboard-page">
      <header className="page-header">
        <h1>Добро пожаловать, {displayName(user?.username)}</h1>
        <p className="subtitle">Оценка инфраструктуры и сравнение точек интереса</p>
      </header>

      <div className="stats-row">
        <div className="stat-box">
          <div className="value tabular">{projects.length}</div>
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
        <Link to="/map" className="quick-card">
          <div className="icon-wrap">
            <Map size={20} />
          </div>
          <strong>Открыть карту</strong>
        </Link>
        <Link to="/matrix" className="quick-card">
          <div className="icon-wrap">
            <Grid3X3 size={20} />
          </div>
          <strong>Матрица</strong>
        </Link>
        <Link to="/report" className="quick-card">
          <div className="icon-wrap">
            <FileOutput size={20} />
          </div>
          <strong>Отчёт</strong>
        </Link>
      </div>

      {filtered.length > 0 && (
        <>
          <h2 className="text-base font-semibold mb-3">Проекты</h2>
          <div className="projects-grid">
            {filtered.map((p) => {
              const st = projectStatus(p.status);
              return (
                <Link key={p.id} to={`/projects/${p.id}`} className="project-card">
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
                </Link>
              );
            })}
          </div>
        </>
      )}

      <div className="card card--flush projects-table-card">
        <ProjectsTableCardHeader
          title="Все проекты"
          search={projectSearch}
          onSearchChange={setProjectSearch}
          actions={
            <Link to="/projects" className="btn btn-primary btn-sm">
              Список
            </Link>
          }
        />
        <div className="table-wrap">
          {filtered.length === 0 ? (
            <p className="p-6 text-sm" style={{ color: 'var(--text-muted)' }}>
              {projects.length === 0
                ? 'Проектов пока нет. Создайте первый через «Новый проект».'
                : 'Ничего не найдено по запросу поиска.'}
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>POI</th>
                  <th>Статус</th>
                  <th>Дата</th>
                  <th>Стоимость</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const st = projectStatus(p.status);
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link
                          to={`/projects/${p.id}`}
                          className="hover:underline"
                          style={{ color: 'var(--primary)', fontWeight: 500 }}
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="tabular">{p.poi_count}</td>
                      <td>
                        <span className={`status ${st.className}`}>{st.label}</span>
                      </td>
                      <td>{formatProjectDate(p.created_at)}</td>
                      <td className="tabular" style={{ color: 'var(--text-muted)' }}>
                        —
                      </td>
                      <td>
                        <Link
                          to={`/projects/${p.id}`}
                          className="btn btn-secondary btn-sm"
                        >
                          Открыть
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
