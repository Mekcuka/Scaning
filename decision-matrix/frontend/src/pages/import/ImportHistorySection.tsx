import type { ImportLog } from '../../lib/api';

type Props = {
  history: ImportLog[];
  isLoading: boolean;
};

export function ImportHistorySection({ history, isLoading }: Props) {
  return (
    <div className="card">
      <h2 className="font-semibold mb-4">История импорта</h2>
      {isLoading && <p className="text-sm">Загрузка…</p>}
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
    </div>
  );
}
