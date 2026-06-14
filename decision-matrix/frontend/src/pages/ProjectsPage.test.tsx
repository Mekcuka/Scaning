import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectsPage } from './ProjectsPage';
import { renderPage } from '../test/pages/renderPage';
import { seedAppStore, seedAuthUser } from '../test/pages/seedAppStore';
import { api } from '../lib/api';
import { makeProject, sampleProjects } from '../test/fixtures/projects';
import { useAppStore } from '../store';

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

async function renderProjectsPageAndWait() {
  renderPage(<ProjectsPage />);
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /новый проект/i })).toBeInTheDocument();
  });
}

async function openCreateModal() {
  await renderProjectsPageAndWait();
  await userEvent.click(screen.getByRole('button', { name: /новый проект/i }));
}

describe('ProjectsPage', () => {
  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
  });

  beforeEach(() => {
    vi.clearAllMocks();
    seedAppStore();
    seedAuthUser();
    vi.mocked(api.projects).mockResolvedValue(sampleProjects);
    vi.mocked(api.createProject).mockImplementation((name: string, description?: string) =>
      Promise.resolve(makeProject({ id: 'p-new', name, description: description ?? null })),
    );
  });

  it('renders project list', async () => {
    renderPage(<ProjectsPage />, { route: '/projects' });
    expect(screen.getByText('Проекты')).toBeInTheDocument();
    await waitFor(
      () => expect(screen.getByTitle('Alpha')).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });

  it('opens create form in modal', async () => {
    await openCreateModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Новый проект' })).toBeInTheDocument();
    expect(screen.getByLabelText('Название')).toBeInTheDocument();
  });

  it('disables create until name is entered', async () => {
    await openCreateModal();
    expect(screen.getByRole('button', { name: 'Создать' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Название'), 'Gamma');
    expect(screen.getByRole('button', { name: 'Создать' })).toBeEnabled();
  });

  it('creates project and closes modal', async () => {
    const created = makeProject({ id: 'p-new', name: 'Gamma', description: 'Desc' });
    vi.mocked(api.createProject).mockResolvedValueOnce(created);
    const { pushToast } = seedAppStore();

    await openCreateModal();
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Gamma' } });
    fireEvent.change(screen.getByLabelText('Описание'), { target: { value: 'Desc' } });
    await userEvent.click(screen.getByRole('button', { name: 'Создать' }));

    await waitFor(() => {
      expect(api.createProject).toHaveBeenCalledWith('Gamma', 'Desc');
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(useAppStore.getState().currentProjectId).toBe('p-new');
    expect(pushToast).toHaveBeenCalledWith('success', 'Проект «Gamma» создан');
  });

  it('submits project on Enter in name field', async () => {
    const created = makeProject({ id: 'p-enter', name: 'Enter project' });
    vi.mocked(api.createProject).mockResolvedValue(created);

    await openCreateModal();
    const nameInput = screen.getByLabelText('Название');
    fireEvent.change(nameInput, { target: { value: 'Enter project' } });
    nameInput.focus();
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(api.createProject).toHaveBeenCalledWith('Enter project', undefined);
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes modal on cancel without creating project', async () => {
    await openCreateModal();
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Draft name' } });
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.createProject).not.toHaveBeenCalled();
  });

  it('shows error toast when create fails', async () => {
    vi.mocked(api.createProject).mockRejectedValue(new Error('Сервер недоступен'));
    const { pushToast } = seedAppStore();

    await openCreateModal();
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Fail' } });
    await userEvent.click(screen.getByRole('button', { name: 'Создать' }));

    await waitFor(() => {
      expect(pushToast).toHaveBeenCalledWith('error', 'Сервер недоступен');
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

});
