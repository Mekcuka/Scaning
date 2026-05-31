import { test, expect } from '@playwright/test';
import { createProject, registerAndLogin } from './helpers';

test.describe('Projects', () => {
  test('create project and open map', async ({ page, request }) => {
    const email = `e2e-create-${Date.now()}@test.ru`;
    const { csrf, cookies } = await registerAndLogin(request, email, 'E2E Create');
    const projectId = await createProject(request, csrf, cookies, `test_e2e_${Date.now()}`);

    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Пароль').fill('password1');
    await page.getByRole('button', { name: /войти/i }).click();
    await page.waitForURL(/\/(dashboard)?$/);

    await page.goto(`/map?project=${projectId}`);
    await expect(page).toHaveURL(/\/map/);
  });

  test('delete project shows confirm modal', async ({ page, request }) => {
    const email = `e2e-del-${Date.now()}@test.ru`;
    const { csrf, cookies } = await registerAndLogin(request, email, 'E2E Delete');
    const name = `test_e2e_del_${Date.now()}`;
    await createProject(request, csrf, cookies, name);

    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Пароль').fill('password1');
    await page.getByRole('button', { name: /войти/i }).click();
    await page.waitForURL(/\/(dashboard)?$/);

    await page.goto('/projects');
    await page.getByRole('button', { name: new RegExp(`Удалить ${name}`) }).click();
    await expect(page.getByTestId('delete-project-confirm')).toBeVisible();
  });
});
