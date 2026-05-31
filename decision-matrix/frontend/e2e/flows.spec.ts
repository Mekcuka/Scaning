import { test, expect } from '@playwright/test';
import { createProject, registerAndLogin } from './helpers';

test('flows section loads', async ({ page, request }) => {
  const email = `e2e-flows-${Date.now()}@test.ru`;
  const { csrf, cookies } = await registerAndLogin(request, email, 'E2E Flows');
  await createProject(request, csrf, cookies, `test_flows_${Date.now()}`);

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill('password1');
  await page.getByRole('button', { name: /войти/i }).click();
  await page.waitForURL(/\/(dashboard)?$/);

  await page.goto('/flows');
  await expect(page).toHaveURL(/\/flows/);
});
