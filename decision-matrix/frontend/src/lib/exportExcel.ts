import * as XLSX from 'xlsx';

export type ExcelColumn<T> = {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
};

export function sanitizeExcelFilename(name: string): string {
  const base = name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '-')
    .trim()
    .slice(0, 80);
  return base.toLowerCase().endsWith('.xlsx') ? base : `${base || 'export'}.xlsx`;
}

export function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, ' ').trim();
  return (cleaned || 'Данные').slice(0, 31);
}

/** Export tabular data to an .xlsx file (browser download). */
export function downloadExcel<T>(
  filename: string,
  sheetName: string,
  columns: ExcelColumn<T>[],
  rows: T[],
): void {
  if (columns.length === 0) {
    throw new Error('Нет колонок для выгрузки');
  }

  const sheetRows = rows.map((row) => {
    const record: Record<string, string | number | boolean> = {};
    for (const col of columns) {
      const raw = col.value(row);
      if (raw === null || raw === undefined || raw === '') {
        record[col.header] = '';
      } else if (typeof raw === 'boolean') {
        record[col.header] = raw ? 'да' : 'нет';
      } else {
        record[col.header] = raw;
      }
    }
    return record;
  });

  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(sheetName));
  XLSX.writeFile(workbook, sanitizeExcelFilename(filename));
}
