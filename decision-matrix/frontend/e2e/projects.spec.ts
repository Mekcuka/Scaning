import { test, expect } from '@playwright/test';
import { createProject, loginViaUi, setupE2eSession } from './helpers';

test.describe('Projects', () => {
  test.describe.configure({ mode: 'serial' });

  let email: string;
  let mapProjectId: string;
  let deleteProjectName: string;

  test.beforeAll(async ({ playwright }) => {
    const ctx = await playwright.request.newContext();
    const session = await setupE2eSession(ctx, 'projects');
    email = session.email;
    mapProjectId = await createProject(ctx, session.csrf, `test_e2e_${Date.now()}`);
    deleteProjectName = `test_e2e_del_${Date.now()}`;
    await createProject(ctx, session.csrf, deleteProjectName);
    await ctx.dispose();
  });

  test('create project and open map', async ({ page }) => {
    await loginViaUi(page, email);
    await page.goto(`/map?project=${mapProjectId}`);
    await expect(page).toHaveURL(/\/map/);
  });

  test('delete project shows confirm modal', async ({ page }) => {
    await loginViaUi(page, email);
    await page.goto('/projects');
    await page.getByRole('button', { name: new RegExp(`Удалить ${deleteProjectName}`) }).click();
    await expect(page.getByTestId('delete-project-confirm')).toBeVisible();
  });

  test('creates project via new project modal', async ({ page }) => {
    const projectName = `test_e2e_ui_${Date.now()}`;
    const projectDescription = 'Создан через UI e2e';

    await loginViaUi(page, email);
    await page.goto('/projects');
    await expect(page.getByRole('heading', { name: 'Проекты' })).toBeVisible();

    await page.getByRole('button', { name: 'Новый проект' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Новый проект' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Создать' })).toBeDisabled();

    await dialog.getByLabel('Название').fill(projectName);
    await dialog.getByLabel('Описание').fill(projectDescription);
    await expect(dialog.getByRole('button', { name: 'Создать' })).toBeEnabled();

    const createResponse = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        r.url().includes('/api/v1/projects') &&
        r.status() === 201,
    );
    await dialog.getByRole('button', { name: 'Создать' }).click();
    await createResponse;

    await expect(dialog).toBeHidden();
    await expect(page.getByRole('link', { name: projectName })).toBeVisible();
    await expect(page.getByText(projectDescription)).toBeVisible();
  });
});
