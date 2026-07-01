import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Import3DPage } from '../Import3DPage';
import { renderPage } from '../../test/pages/renderPage';
import { seedAppStore, seedAuthUser } from '../../test/pages/seedAppStore';
import { makeProject } from '../../test/fixtures/projects';
import { api } from '../../lib/api';
import * as map3dCustomAssets from '../../lib/map3d/map3dCustomAssets';

vi.mock('../../lib/api', async (importOriginal) => {
  const { createApiMock } = await import('../../test/pages/apiMockModule');
  return createApiMock(importOriginal);
});

vi.mock('../../components/map3d/Import3dPreview', () => ({
  Import3dPreview: () => <div data-testid="import3d-preview" />,
}));

describe('Import3DPage', () => {
  beforeEach(() => {
    seedAppStore({ currentProjectId: 'p1' });
    seedAuthUser({ role: 'admin' });
    vi.mocked(api.listMap3dCustomModels).mockResolvedValue([]);
  });

  it('renders admin import 3d page with upload', async () => {
    renderPage(<Import3DPage />, { route: '/import-3d' });
    expect(screen.getByText('Импорт 3D')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Загрузка GLB')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('import3d-preview')).toBeInTheDocument());
  });

  it('registers custom GLB assets for preview without visiting map', async () => {
    const spy = vi.spyOn(map3dCustomAssets, 'setProjectCustomGltfAssets');
    vi.mocked(api.listMap3dCustomModels).mockResolvedValue([
      {
        id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        project_id: 'p1',
        filename: 'tank.glb',
        display_name: 'tank',
        target_height_m: 8,
        file_size_bytes: 0,
        created_at: '2026-01-01T00:00:00Z',
        assigned_subtypes: [],
        usage_count: 0,
      },
    ]);
    renderPage(<Import3DPage />, { route: '/import-3d' });
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        'p1',
        expect.arrayContaining([
          expect.objectContaining({ id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }),
        ]),
      ),
    );
    spy.mockRestore();
  });

  it('renders owner assign without upload card', async () => {
    seedAuthUser({ id: 'u1', role: 'analyst' });
    vi.mocked(api.projects).mockResolvedValue([makeProject({ id: 'p1', owner_user_id: 'u1' })]);
    renderPage(<Import3DPage />, { route: '/import-3d' });
    await waitFor(() =>
      expect(screen.getAllByText('Назначение подтипам').length).toBeGreaterThan(0),
    );
    expect(screen.queryByText('Загрузка GLB')).not.toBeInTheDocument();
    expect(screen.getAllByText('Модели проекта').length).toBeGreaterThan(0);
  });
});
