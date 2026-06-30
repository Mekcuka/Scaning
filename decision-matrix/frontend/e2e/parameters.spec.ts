import { test, expect } from '@playwright/test';
import { createProject, loginViaUi, registerAndLogin } from './helpers';

test('parameters tab shows capacity table', async ({ page, request }) => {
  const email = `e2e-params-${Date.now()}@test.ru`;
  const csrf = await registerAndLogin(request, email, 'E2E Params');
  const projectId = await createProject(request, csrf, `test_params_${Date.now()}`);

  await loginViaUi(page, email);

  await page.goto(`/parameters/capacity/${projectId}`);
  await expect(page).toHaveURL(new RegExp(`/parameters/capacity/${projectId}`));
  await expect(page.getByRole('tab', { name: 'Пропускная способность' })).toBeVisible();

  const main = page.locator('.app-main');
  await expect(main).toBeVisible();
  const canScroll = await main.evaluate((el) => el.scrollHeight > el.clientHeight);
  expect(canScroll).toBe(true);
  await main.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  expect(await main.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
});
