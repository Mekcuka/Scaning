import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { ReportListPage } from './ReportListPage';
import { renderPage } from '../../test/pages/renderPage';
import { seedAppStore } from '../../test/pages/seedAppStore';
import { api } from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
  const { createApiMock } = await import('../../test/pages/apiMockModule');
  return createApiMock(importOriginal);
});
vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({ canWriteProject: true }),
}));

describe('ReportListPage', () => {
  beforeEach(() => {
    seedAppStore({ currentProjectId: 'p1' });
    vi.mocked(api.getOnePagers).mockResolvedValue([
      {
        id: 'r1',
        poi_id: 'poi-1',
        poi_name: 'Q1 Report',
        generation_status: 'ready',
        report_date: '2024-01-01',
      },
    ] as never);
  });

  it('renders reports list', async () => {
    renderPage(<ReportListPage />);
    expect(screen.getByText('Отчёты')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Q1 Report')).toBeInTheDocument());
  });

});
