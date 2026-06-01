import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Import3DPage } from './Import3DPage';
import { renderPage } from '../test/pages/renderPage';
import { seedAppStore, seedAuthUser } from '../test/pages/seedAppStore';
import { makeProject } from '../test/fixtures/projects';
import { api } from '../lib/api';

vi.mock('../lib/api', async (importOriginal) => {
  const { createApiMock } = await import('../test/pages/apiMockModule');
  return createApiMock(importOriginal);
});

vi.mock('../components/map3d/Import3dPreview', () => ({
  Import3dPreview: () => <div data-testid="import3d-preview" />,
}));

describe('Import3DPage', () => {
  beforeEach(() => {
    seedAppStore({ currentProjectId: 'p1' });
    seedAuthUser({ role: 'admin' });
  });

  it('renders admin import 3d page with upload', async () => {
    renderPage(<Import3DPage />, { route: '/import-3d' });
    expect(screen.getByText('Импорт 3D')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Загрузка GLB')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('import3d-preview')).toBeInTheDocument());
  });

  it('renders owner assign without upload card', async () => {
    seedAuthUser({ id: 'u1', role: 'analyst' });
    vi.mocked(api.projects).mockResolvedValue([makeProject({ id: 'p1', owner_user_id: 'u1' })]);
    renderPage(<Import3DPage />, { route: '/import-3d' });
    await waitFor(() => expect(screen.getByText('Назначение объекту')).toBeInTheDocument());
    expect(screen.queryByText('Загрузка GLB')).not.toBeInTheDocument();
    expect(screen.getByText('Модели проекта')).toBeInTheDocument();
  });
});
