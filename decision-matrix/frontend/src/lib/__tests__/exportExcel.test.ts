import { describe, expect, it } from 'vitest';
import { sanitizeExcelFilename, sanitizeSheetName } from '../exportExcel';

describe('sanitizeExcelFilename', () => {
  it('adds .xlsx and replaces invalid characters', () => {
    expect(sanitizeExcelFilename('report:2024')).toBe('report_2024.xlsx');
  });

  it('keeps existing .xlsx extension', () => {
    expect(sanitizeExcelFilename('data.xlsx')).toBe('data.xlsx');
  });
});

describe('sanitizeSheetName', () => {
  it('truncates to 31 characters and strips invalid chars', () => {
    const long = 'a'.repeat(40);
    expect(sanitizeSheetName(long)).toHaveLength(31);
  });

  it('falls back to default when empty', () => {
    expect(sanitizeSheetName('   ')).toBe('Данные');
  });
});
