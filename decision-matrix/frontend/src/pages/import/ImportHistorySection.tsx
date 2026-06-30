import { History } from 'lucide-react';
import { Card } from 'antd';
import type { ImportLog } from '../../lib/api';

type Props = {
  history: ImportLog[];
  isLoading: boolean;
};

export function ImportHistorySection({ history, isLoading }: Props) {
  return (
    <Card size="small" className="import-history">
      <div className="import-history__head">
        <span className="import-history__icon" aria-hidden>
          <History size={20} />
        </span>
        <div>
          <h2 className="import-history__title">История импорта</h2>
          <p className="import-history__hint">
            {isLoading
              ? 'Загрузка…'
              : history.length === 0
                ? 'Операций импорта пока нет'
                : `${history.length} ${history.length === 1 ? 'запись' : history.length < 5 ? 'записи' : 'записей'}`}
          </p>
        </div>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Файл</th>
              <th>Источник</th>
              <th>Статус</th>
              <th>Записей</th>
              <th>Ошибки</th>
            </tr>
          </thead>
          <tbody>
            {history.map((log) => (
              <tr key={log.id}>
                <td>{log.file_name || '—'}</td>
                <td>{log.source_type}</td>
                <td>{log.status}</td>
                <td>
                  {log.records_imported}/{log.records_total}
                </td>
                <td className="text-xs max-w-xs truncate" title={(log.errors || []).join('\n')}>
                  {(log.errors || []).length ? log.errors.slice(0, 2).join('; ') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
