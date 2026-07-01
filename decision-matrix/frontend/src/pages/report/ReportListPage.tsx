import { ProjectLink } from '../../components/ProjectLink';
import { Download, FileText, Plus, Trash2 } from 'lucide-react';
import { Button, Card, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useOnePagerList } from '../../hooks/useOnePagerList';
import { useAppStore } from '../../store';
import { usePermissions } from '../../hooks/usePermissions';
import { usePageHeader } from '../../components/layout/pageHeaderContext';
import { AppDataTable } from '../../components/AppDataTable';
import type { OnePager } from '../../lib/api';

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

  const columns: ColumnsType<OnePager> = [
    {
      title: 'POI',
      key: 'poi',
      render: (_, r) => r.poi_name ?? r.poi_id.slice(0, 8),
    },
    {
      title: 'Дата',
      dataIndex: 'report_date',
      key: 'report_date',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Статус PPTX',
      key: 'generation_status',
      render: (_, r) => STATUS_LABEL[r.generation_status] ?? r.generation_status,
    },
    {
      title: 'Действия',
      key: 'actions',
      className: 'col-actions',
      render: (_, r) => (
        <Space size="small" wrap>
          <ProjectLink to={`/report/${r.id}`}>
            <Button size="small" icon={<FileText size={14} />}>
              Открыть
            </Button>
          </ProjectLink>
          <ProjectLink to={`/report/${r.id}?print=1`}>
            <Button size="small" icon={<Download size={14} />}>
              PDF
            </Button>
          </ProjectLink>
          {canWriteProject && (
            <Button
              size="small"
              icon={<FileText size={14} />}
              loading={pptxMut.isPending}
              onClick={() => pptxMut.mutate(r.id)}
            >
              PPTX
            </Button>
          )}
          {canWriteProject && (
            <Button
              size="small"
              icon={<Trash2 size={14} />}
              loading={deleteMut.isPending}
              onClick={() => {
                if (window.confirm('Удалить одностраничник?')) {
                  deleteMut.mutate(r.id);
                }
              }}
            />
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {projectId && canWriteProject && (
        <div className="page-toolbar page-toolbar--actions-only">
          <div className="page-toolbar-actions">
            <ProjectLink to="/report/new">
              <Button type="primary" icon={<Plus size={16} />}>
                Подготовить отчёт
              </Button>
            </ProjectLink>
          </div>
        </div>
      )}

      {!projectId ? (
        <Card size="small" className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Выберите проект в шапке приложения.
        </Card>
      ) : isLoading ? (
        <Card size="small" className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Загрузка…
        </Card>
      ) : reports.length === 0 ? (
        <Card size="small" className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Нет сохранённых одностраничников.
          {canWriteProject && (
            <>
              {' '}
              <ProjectLink to="/report/new">Создать первый отчёт</ProjectLink>
            </>
          )}
        </Card>
      ) : (
        <Card>
          <AppDataTable<OnePager>
            rowKey="id"
            columns={columns}
            dataSource={reports}
            emptyText="Нет сохранённых одностраничников"
          />
        </Card>
      )}
    </div>
  );
}
