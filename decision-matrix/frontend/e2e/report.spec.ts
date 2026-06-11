import { test, expect } from '@playwright/test';
import { createProject, loginViaUi, registerAndLogin } from './helpers';

test('report list page renders', async ({ page, request }) => {
  const email = `e2e-report-${Date.now()}@test.ru`;
  const csrf = await registerAndLogin(request, email, 'E2E Report');
  const projectId = await createProject(request, csrf, `test_report_${Date.now()}`);

  await loginViaUi(page, email);
  await page.goto(`/report?project=${projectId}`);

  await expect(page.getByRole('heading', { name: 'Отчёты' })).toBeVisible();
});
