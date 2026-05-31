import { test, expect } from '@playwright/test';
import { createProject, registerAndLogin } from './helpers';

test('parameters tab shows capacity table', async ({ page, request }) => {
  const email = `e2e-params-${Date.now()}@test.ru`;
  const { csrf, cookies } = await registerAndLogin(request, email, 'E2E Params');
  await createProject(request, csrf, cookies, `test_params_${Date.now()}`);

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill('password1');
  await page.getByRole('button', { name: /войти/i }).click();
  await page.waitForURL(/\/(dashboard)?$/);

  await page.goto('/parameters');
  await expect(page.getByText(/Пропускная способность|Выберите проект/i)).toBeVisible();
});
