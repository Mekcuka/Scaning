import { test, expect } from '@playwright/test';
import {
  createInfraPoint,
  createLayer,
  createProject,
  loginViaUi,
  registerAndLogin,
} from './helpers';

test('parameters tab shows capacity table', async ({ page, request }) => {
  const email = `e2e-params-${Date.now()}@test.ru`;
  const csrf = await registerAndLogin(request, email, 'E2E Params');
  const projectId = await createProject(request, csrf, `test_params_${Date.now()}`);
  const layerId = await createLayer(request, csrf, projectId);
  await createInfraPoint(request, csrf, projectId, {
    layerId,
    name: 'E2E объект',
    subtype: 'gas_processing',
    lon: 37.6,
    lat: 55.75,
  });

  await loginViaUi(page, email);

  await page.goto(`/parameters/capacity/${projectId}`);
  await expect(page).toHaveURL(new RegExp(`/parameters/capacity/${projectId}`));
  await expect(page.getByRole('tab', { name: 'Пропускная способность' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Объект' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'E2E объект' })).toBeVisible();
});
