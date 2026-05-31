import { Download } from 'lucide-react';
import { downloadExcel, type ExcelColumn } from '../lib/exportExcel';
import { useAppStore } from '../store';

type Props<T> = {
  filename: string;
  sheetName?: string;
  columns: ExcelColumn<T>[];
  rows: T[];
  disabled?: boolean;
};

export function TableExcelExportButton<T>({
  filename,
  sheetName = 'Данные',
  columns,
  rows,
  disabled = false,
}: Props<T>) {
  const pushToast = useAppStore((s) => s.pushToast);

  const handleClick = () => {
    if (rows.length === 0) {
      pushToast('info', 'Нет данных для выгрузки');
      return;
    }
    try {
      downloadExcel(filename, sheetName, columns, rows);
      pushToast('success', 'Файл Excel сохранён');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Не удалось выгрузить Excel');
    }
  };

  return (
    <button
      type="button"
      className="table-excel-export-btn"
      onClick={handleClick}
      disabled={disabled || rows.length === 0}
      title="Скачать Excel"
      aria-label="Скачать Excel"
    >
      <Download size={14} strokeWidth={2} aria-hidden />
    </button>
  );
}

/** Пустая ячейка в строке данных под колонку «Скачать» в thead. */
export function TableExcelExportBodyCell() {
  return <td className="table-excel-export-td" aria-hidden="true" />;
}
