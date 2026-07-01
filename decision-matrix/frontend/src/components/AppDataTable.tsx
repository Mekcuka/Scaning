import type { ReactNode } from 'react';
import { Table } from 'antd';
import type { TableProps } from 'antd';
import { TableExcelExportButton } from './TableExcelExportButton';
import type { ExcelColumn } from '../lib/exportExcel';

export type AppDataTableExcelExport<T> = {
  filename: string;
  sheetName?: string;
  columns: ExcelColumn<T>[];
  rows: T[];
  disabled?: boolean;
};

export type AppDataTableProps<T extends object> = Omit<
  TableProps<T>,
  'size' | 'pagination' | 'locale'
> & {
  excelExport?: AppDataTableExcelExport<T>;
  tableExtra?: ReactNode;
  emptyText?: string;
};

export function AppDataTable<T extends object>({
  excelExport,
  tableExtra,
  emptyText = 'Нет данных',
  scroll,
  className,
  ...rest
}: AppDataTableProps<T>) {
  const showToolbar = Boolean(excelExport || tableExtra);

  return (
    <div className={['app-data-table-wrap', className].filter(Boolean).join(' ')}>
      {showToolbar ? (
        <div className="app-data-table-toolbar">
          <div className="app-data-table-toolbar__main">{tableExtra}</div>
          {excelExport ? (
            <TableExcelExportButton
              filename={excelExport.filename}
              sheetName={excelExport.sheetName}
              columns={excelExport.columns}
              rows={excelExport.rows}
              disabled={excelExport.disabled}
            />
          ) : null}
        </div>
      ) : null}
      <Table<T>
        className={['app-data-table', className].filter(Boolean).join(' ')}
        size="small"
        pagination={false}
        locale={{ emptyText }}
        scroll={scroll ?? { x: 'max-content' }}
        {...rest}
      />
    </div>
  );
}
