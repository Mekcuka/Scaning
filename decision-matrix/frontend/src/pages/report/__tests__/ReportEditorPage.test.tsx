import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportEditorPage } from '../ReportEditorPage';
import { renderPage } from '../../../test/pages/renderPage';
import { seedAppStore } from '../../../test/pages/seedAppStore';
vi.mock('../../../lib/api', async (importOriginal) => {
  const { createApiMock } = await import('../../../test/pages/apiMockModule');
  return createApiMock(importOriginal);
});
vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => ({ canWriteProject: true }),
}));
vi.mock('../../../lib/mapSnapshot', () => ({
  captureMapSnapshot: vi.fn().mockResolvedValue('data:image/png;base64,x'),
  downloadBlob: vi.fn(),
}));

vi.mock('../../../components/MapView', () => ({
  MapView: () => <div data-testid="mock-map-view" />,
}));

vi.mock('../../../components/MapView3D', () => ({
  default: () => <div data-testid="mock-map-3d" />,
}));

describe('ReportEditorPage', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    seedAppStore({ currentProjectId: 'p1' });
  });

  it('renders new report editor', async () => {
    renderPage(<ReportEditorPage mode="new" />, { route: '/report/new' });
    await waitFor(() =>
      expect(screen.getByText('Новый одностраничник')).toBeInTheDocument(),
    );
  });

  it('renders edit mode loading then content', async () => {
    renderPage(<ReportEditorPage mode="edit" />, {
      initialEntries: ['/report/r1'],
      route: '/report/r1',
    });
    expect(await screen.findByText(/Одностраничник|Загрузка отчёта/)).toBeTruthy();
  });

  it('generates new one-pager when analysis is ready', async () => {
    const { api } = await import('../../../lib/api');
    vi.mocked(api.getPoiAnalysis).mockResolvedValue({
      poi_id: 'poi-1',
      rows: [{ subtype: 'gas_processing', status: 'within_limit', param_type: 'internal' }],
      computed_at: '2024-01-01',
    } as never);
    renderPage(<ReportEditorPage mode="new" />, { route: '/report/new' });
    await waitFor(() => expect(screen.getByText('Новый одностраничник')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /сформировать отчёт/i })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole('button', { name: /сформировать отчёт/i }));
    await waitFor(() => expect(api.createOnePager).toHaveBeenCalled());
  });

  it('saves existing one-pager in edit mode', async () => {
    const { api } = await import('../../../lib/api');
    vi.mocked(api.getOnePager).mockResolvedValue({
      id: 'r1',
      project_id: 'p1',
      poi_id: 'poi-1',
      title: 'Saved report',
      status: 'ready',
      content: { roadmap: [], recommendation_text: 'Text' },
    } as never);
    vi.mocked(api.getPoiAnalysis).mockResolvedValue({
      poi_id: 'poi-1',
      rows: [{ subtype: 'gas_processing', status: 'within_limit' }],
      computed_at: '2024-01-01',
    } as never);
    renderPage(<ReportEditorPage mode="edit" />, {
      initialEntries: ['/report/r1'],
      route: '/report/r1',
    });
    await waitFor(() => expect(screen.getByRole('button', { name: /сохранить/i })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: /сохранить/i }));
    await waitFor(() => expect(api.updateOnePager).toHaveBeenCalled());
  });

  it('exports pptx in edit mode', async () => {
    const { api } = await import('../../../lib/api');
    vi.mocked(api.getOnePager).mockResolvedValue({
      id: 'r1',
      project_id: 'p1',
      poi_id: 'poi-1',
      title: 'Saved report',
      status: 'ready',
      content: { roadmap: [], recommendation_text: 'Text' },
    } as never);
    vi.mocked(api.getPoiAnalysis).mockResolvedValue({
      poi_id: 'poi-1',
      rows: [{ subtype: 'gas_processing', status: 'within_limit' }],
      computed_at: '2024-01-01',
    } as never);
    renderPage(<ReportEditorPage mode="edit" />, {
      initialEntries: ['/report/r1'],
      route: '/report/r1',
    });
    const pptxBtn = await screen.findByRole('button', { name: /pptx/i });
    await userEvent.click(pptxBtn);
    await waitFor(() => expect(api.exportOnePagerPptx).toHaveBeenCalled());
  });
});
