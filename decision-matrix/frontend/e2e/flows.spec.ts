import { test, expect } from '@playwright/test';
import { createProject, loginViaUi, registerAndLogin } from './helpers';

test('flows section loads', async ({ page, request }) => {
  const email = `e2e-flows-${Date.now()}@test.ru`;
  const csrf = await registerAndLogin(request, email, 'E2E Flows');
  await createProject(request, csrf, `test_flows_${Date.now()}`);

  await loginViaUi(page, email);

  await page.goto('/flows');
  await expect(page).toHaveURL(/\/flows/);
});
