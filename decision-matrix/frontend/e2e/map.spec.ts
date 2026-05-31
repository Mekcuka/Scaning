import { test, expect } from '@playwright/test';
import { createProject, registerAndLogin } from './helpers';

test.describe('Map', () => {
  test('map page loads in 2D mode', async ({ page, request }) => {
    const email = `e2e-map-${Date.now()}@test.ru`;
    const { csrf, cookies } = await registerAndLogin(request, email, 'E2E Map');
    const projectId = await createProject(request, csrf, cookies, `test_map_${Date.now()}`);

    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Пароль').fill('password1');
    await page.getByRole('button', { name: /войти/i }).click();
    await page.waitForURL(/\/(dashboard)?$/);

    await page.goto('/map');
    await expect(page).toHaveURL(/\/map/);
    await expect(page.locator('.ol-viewport').first()).toBeVisible({ timeout: 15_000 });
  });

  test.skip('draw line on map (manual / staging)', async () => {
    // Full draw interaction requires stable map toolbar selectors; enable when data-testid added.
  });
});
