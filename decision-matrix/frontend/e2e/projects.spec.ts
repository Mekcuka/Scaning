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
});
