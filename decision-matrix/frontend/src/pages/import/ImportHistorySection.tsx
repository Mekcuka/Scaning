import { useMemo } from 'react';
import { History } from 'lucide-react';
import { Card } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { ImportLog } from '../../lib/api';
import { AppDataTable } from '../../components/AppDataTable';

type Props = {
  history: ImportLog[];
  isLoading: boolean;
};

const columns: ColumnsType<ImportLog> = [
  { title: 'Файл', dataIndex: 'file_name', key: 'file_name', render: (v: string) => v || '—' },
  { title: 'Источник', dataIndex: 'source_type', key: 'source_type' },
  { title: 'Статус', dataIndex: 'status', key: 'status' },
  {
    title: 'Записей',
    key: 'records',
    render: (_, log) => `${log.records_imported}/${log.records_total}`,
  },
  {
    title: 'Ошибки',
    key: 'errors',
    ellipsis: true,
    render: (_, log) => {
      const errors = log.errors || [];
      const text = errors.length ? errors.slice(0, 2).join('; ') : '—';
      return (
        <span className="text-xs max-w-xs truncate" title={errors.join('\n')}>
          {text}
        </span>
      );
    },
  },
];

export function ImportHistorySection({ history, isLoading }: Props) {
  const hint = useMemo(() => {
    if (isLoading) return 'Загрузка…';
    if (history.length === 0) return 'Операций импорта пока нет';
    const n = history.length;
    const word = n === 1 ? 'запись' : n < 5 ? 'записи' : 'записей';
    return `${n} ${word}`;
  }, [history.length, isLoading]);

  return (
    <Card size="small" className="import-history">
      <div className="import-history__head">
        <span className="import-history__icon" aria-hidden>
          <History size={20} />
        </span>
        <div>
          <h2 className="import-history__title">История импорта</h2>
          <p className="import-history__hint">{hint}</p>
        </div>
      </div>
      <AppDataTable<ImportLog>
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={history}
        emptyText="Операций импорта пока нет"
      />
    </Card>
  );
}
