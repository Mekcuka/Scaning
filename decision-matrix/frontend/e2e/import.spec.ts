import { test, expect } from '@playwright/test';
import { createProject, loginViaUi, registerAndLogin } from './helpers';

test('import page renders', async ({ page, request }) => {
  const email = `e2e-import-${Date.now()}@test.ru`;
  const csrf = await registerAndLogin(request, email, 'E2E Import');
  const projectId = await createProject(request, csrf, `test_import_${Date.now()}`);

  await loginViaUi(page, email);

  await page.goto(`/data/import/${projectId}`);
  await expect(page.getByText(/Импорт/i).first()).toBeVisible();
});
