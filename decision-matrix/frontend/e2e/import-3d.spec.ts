import { test, expect } from '@playwright/test';
import { createProject, loginViaUi, registerAndLogin } from './helpers';

test('import 3d page renders for project owner', async ({ page, request }) => {
  const email = `e2e-import3d-${Date.now()}@test.ru`;
  const csrf = await registerAndLogin(request, email, 'E2E Import3D');
  const projectId = await createProject(request, csrf, `test_import3d_${Date.now()}`);

  await loginViaUi(page, email);
  await page.goto(`/import-3d?project=${projectId}`);

  await expect(page.getByRole('heading', { name: 'Импорт 3D' })).toBeVisible();
  await expect(page.getByText('Назначение подтипам')).toBeVisible();
  await expect(page.getByText('Превью на карте')).toBeVisible();
});
