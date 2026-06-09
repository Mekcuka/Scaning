import { describe, expect, it } from 'vitest';
import { projectExportFilename, sanitizeExportBasename } from './sanitizeFilename';

describe('sanitizeExportBasename', () => {
  it('replaces invalid characters and whitespace', () => {
    expect(sanitizeExportBasename('My Project: export')).toBe('My-Project_-export');
  });

  it('falls back to export when empty after sanitizing', () => {
    expect(sanitizeExportBasename('   ')).toBe('export');
  });
});

describe('projectExportFilename', () => {
  it('adds extension to sanitized basename', () => {
    expect(projectExportFilename('Demo', 'points', 'csv')).toMatch(/^Demo-points-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
