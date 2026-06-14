import { test, expect } from '@playwright/test';
import { createProject, loginViaUi, registerAndLogin } from './helpers';

test('matrix page renders', async ({ page, request }) => {
  const email = `e2e-matrix-${Date.now()}@test.ru`;
  const csrf = await registerAndLogin(request, email, 'E2E Matrix');
  const projectId = await createProject(request, csrf, `test_matrix_${Date.now()}`);

  await loginViaUi(page, email);
  await page.goto(`/matrix/${projectId}`);

  await expect(page.getByRole('heading', { name: 'Матрица решений' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Таблица' })).toBeVisible();
});
