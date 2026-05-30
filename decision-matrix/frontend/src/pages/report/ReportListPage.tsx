import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Plus, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { downloadBlob } from '../../lib/mapSnapshot';
import { useAppStore } from '../../store';
import { usePermissions } from '../../hooks/usePermissions';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Ожидает',
  ready: 'Готов',
  error: 'Ошибка',
};

export function ReportListPage() {
  const projectId = useAppStore((s) => s.currentProjectId);
  const { canWriteProject } = usePermissions();
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['one-pagers', projectId],
    queryFn: () => api.getOnePagers(projectId!),
    enabled: !!projectId,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteOnePager(projectId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['one-pagers', projectId] });
      pushToast('success', 'Отчёт удалён');
    },
    onError: (e: Error) => pushToast('error', e.message),
  });

  const pptxMut = useMutation({
    mutationFn: (reportId: string) => api.exportOnePagerPptx(projectId!, reportId),
    onSuccess: (blob, reportId) => {
      downloadBlob(blob, `one-pager-${reportId.slice(0, 8)}.pptx`);
      queryClient.invalidateQueries({ queryKey: ['one-pagers', projectId] });
      pushToast('success', 'PPTX скачан');
    },
    onError: (e: Error) => pushToast('error', e.message),
  });

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-title-block">
          <h1 className="page-title">Отчёты</h1>
          <p className="page-subtitle">Одностраничники для руководства (FR-11)</p>
        </div>
        {projectId && canWriteProject && (
          <div className="page-toolbar-actions">
            <Link to="/report/new" className="btn btn-primary">
              <Plus size={16} /> Подготовить отчёт
            </Link>
          </div>
        )}
      </div>

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
              <Link to="/report/new">Создать первый отчёт</Link>
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
                    <Link to={`/report/${r.id}`} className="btn btn-secondary btn-sm">
                      <FileText size={14} /> Открыть
                    </Link>
                    <Link to={`/report/${r.id}?print=1`} className="btn btn-secondary btn-sm">
                      <Download size={14} /> PDF
                    </Link>
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
