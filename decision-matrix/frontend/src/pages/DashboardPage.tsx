import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FolderOpen, Map, Grid3X3 } from 'lucide-react';
import { api } from '../lib/api';
import { PoiParamsPanel } from '../components/PoiParamsPanel';
import { useAuthStore, useAppStore } from '../store';

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const projectId = useAppStore((s) => s.currentProjectId);
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: api.projects });

  return (
    <div>
      <div className="card mb-6" style={{ background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', color: 'white', border: 'none' }}>
        <h1 className="text-2xl font-bold mb-1">Добро пожаловать, {user?.username?.split(' ')[0] || 'Engineer'}</h1>
        <p className="opacity-90 text-sm">MVP системы поддержки принятия решений для нефтегазовой отрасли</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <FolderOpen size={20} className="text-blue-600" />
            <span className="font-semibold">Проекты</span>
          </div>
          <div className="text-3xl font-bold">{projects.length}</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <Map size={20} className="text-green-600" />
            <span className="font-semibold">POI всего</span>
          </div>
          <div className="text-3xl font-bold">{projects.reduce((s, p) => s + p.poi_count, 0)}</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <Grid3X3 size={20} className="text-purple-600" />
            <span className="font-semibold">Активных</span>
          </div>
          <div className="text-3xl font-bold">{projects.filter((p) => p.status === 'active').length}</div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-4 text-center">Быстрые действия</h2>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link to="/projects" className="btn btn-primary">Проекты</Link>
          <Link to="/map" className="btn btn-secondary">Карта</Link>
          <Link to="/matrix" className="btn btn-secondary">Матрица</Link>
          <Link to="/rates" className="btn btn-secondary">Ставки</Link>
        </div>
      </div>

      {projects.length > 0 && (
        <div className="card mt-4">
          <h2 className="font-semibold mb-3">Последние проекты</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>POI</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {projects.slice(0, 5).map((p) => (
                  <tr key={p.id}>
                    <td><Link to={`/projects/${p.id}`} className="text-blue-600 hover:underline">{p.name}</Link></td>
                    <td>{p.poi_count}</td>
                    <td><span className="badge badge-muted">{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PoiParamsPanel
        projectId={projectId}
        readOnly
        showSave={false}
        sections={['basic', 'engineering', 'thresholds']}
        title="Параметры POI (сводка)"
        className="mt-4"
      />
    </div>
  );
}
