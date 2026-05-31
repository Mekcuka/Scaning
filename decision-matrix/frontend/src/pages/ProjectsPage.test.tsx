import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectsPage } from './ProjectsPage';
import { renderPage } from '../test/pages/renderPage';
import { seedAppStore, seedAuthUser } from '../test/pages/seedAppStore';
import { api } from '../lib/api';
import { sampleProjects } from '../test/fixtures/projects';

vi.mock('../lib/api', async (importOriginal) => {
  const { createApiMock } = await import('../test/pages/apiMockModule');
  return createApiMock(importOriginal);
});
vi.mock('../hooks/usePermissions', () => ({
  usePermissions: () => ({
    can: () => true,
    isReadOnly: false,
    canWriteProject: true,
  }),
}));

describe('ProjectsPage', () => {
  beforeEach(() => {
    seedAppStore();
    seedAuthUser();
    vi.mocked(api.projects).mockResolvedValue(sampleProjects);
  });

  it('renders project list', async () => {
    renderPage(<ProjectsPage />);
    expect(screen.getByText('Проекты')).toBeInTheDocument();
    await waitFor(
      () => expect(screen.getByTitle('Alpha')).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });

  it('opens create form', async () => {
    renderPage(<ProjectsPage />);
    await userEvent.click(screen.getByRole('button', { name: /новый проект/i }));
    expect(screen.getByText('Новый проект')).toBeInTheDocument();
  });

});
