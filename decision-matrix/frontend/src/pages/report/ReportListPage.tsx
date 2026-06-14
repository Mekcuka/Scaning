import { ProjectLink } from '../../components/ProjectLink';
import { Download, FileText, Plus, Trash2 } from 'lucide-react';
import { useOnePagerList } from '../../hooks/useOnePagerList';
import { useAppStore } from '../../store';
import { usePermissions } from '../../hooks/usePermissions';
import { usePageHeader } from '../../components/layout/pageHeaderContext';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Ожидает',
  ready: 'Готов',
  error: 'Ошибка',
};

export function ReportListPage() {
  const projectId = useAppStore((s) => s.currentProjectId);
  const { canWriteProject } = usePermissions();
  const { reports, isLoading, deleteMut, pptxMut } = useOnePagerList(projectId);

  usePageHeader(
    {
      title: 'Отчёты',
      subtitle: 'Одностраничники для руководства',
    },
    [],
  );

  return (
    <div>
      {projectId && canWriteProject && (
        <div className="page-toolbar page-toolbar--actions-only">
          <div className="page-toolbar-actions">
            <ProjectLink to="/report/new" className="btn btn-primary">
              <Plus size={16} /> Подготовить отчёт
            </ProjectLink>
          </div>
        </div>
      )}

      {!projectId ? (
        <div className="card text-sm" style={{ color: 'var(--text-muted)' }}>
          Выберите проект в шапке приложения.
        </div>
      ) : isLoading ? (
        <div className="card text-sm" style={{ color: 'var(--text-muted)' }}>
          Загрузка…
        </div>
      ) : reports.length === 0 ? (
        <div className="card text-sm" style={{ color: 'var(--text-muted)' }}>
          Нет сохранённых одностраничников.
          {canWriteProject && (
            <>
              {' '}
              <ProjectLink to="/report/new">Создать первый отчёт</ProjectLink>
            </>
          )}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>POI</th>
                <th>Дата</th>
                <th>Статус PPTX</th>
                <th className="col-actions">Действия</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>{r.poi_name ?? r.poi_id.slice(0, 8)}</td>
                  <td>{r.report_date ?? '—'}</td>
                  <td>{STATUS_LABEL[r.generation_status] ?? r.generation_status}</td>
                  <td className="col-actions">
                    <ProjectLink to={`/report/${r.id}`} className="btn btn-secondary btn-sm">
                      <FileText size={14} /> Открыть
                    </ProjectLink>
                    <ProjectLink to={`/report/${r.id}?print=1`} className="btn btn-secondary btn-sm">
                      <Download size={14} /> PDF
                    </ProjectLink>
                    {canWriteProject && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={pptxMut.isPending}
                        onClick={() => pptxMut.mutate(r.id)}
                      >
                        <FileText size={14} /> PPTX
                      </button>
                    )}
                    {canWriteProject && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          if (window.confirm('Удалить одностраничник?')) {
                            deleteMut.mutate(r.id);
                          }
                        }}
                        disabled={deleteMut.isPending}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
