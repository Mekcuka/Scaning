import { test, expect } from '@playwright/test';
import { createProject, registerAndLogin } from './helpers';

test('import page renders', async ({ page, request }) => {
  const email = `e2e-import-${Date.now()}@test.ru`;
  const { csrf, cookies } = await registerAndLogin(request, email, 'E2E Import');
  await createProject(request, csrf, cookies, `test_import_${Date.now()}`);

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill('password1');
  await page.getByRole('button', { name: /войти/i }).click();
  await page.waitForURL(/\/(dashboard)?$/);

  await page.goto('/import');
  await expect(page.getByText(/Импорт/i).first()).toBeVisible();
});
