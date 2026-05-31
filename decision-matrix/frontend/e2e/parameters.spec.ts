import { test, expect } from '@playwright/test';
import { createProject, loginViaUi, registerAndLogin } from './helpers';

test('parameters tab shows capacity table', async ({ page, request }) => {
  const email = `e2e-params-${Date.now()}@test.ru`;
  const csrf = await registerAndLogin(request, email, 'E2E Params');
  await createProject(request, csrf, `test_params_${Date.now()}`);

  await loginViaUi(page, email);

  await page.goto('/parameters');
  await expect(page.getByText(/Пропускная способность|Выберите проект/i)).toBeVisible();
});
