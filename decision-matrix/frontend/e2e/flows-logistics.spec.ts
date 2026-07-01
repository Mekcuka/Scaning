import { test, expect } from '@playwright/test';
import {
  loginViaApi,
  loginViaUi,
  seedSandLogisticsNetwork,
  expectAppMainScrollable,
  setupE2eSession,
  type CsrfHolder,
} from './helpers';

test.describe('Flows logistics', () => {
  test.describe.configure({ mode: 'serial', timeout: 90_000 });

  let email: string;
  let projectId: string;

  test.beforeAll(async ({ playwright }) => {
    const ctx = await playwright.request.newContext();
    const session = await setupE2eSession(ctx, 'logistics');
    email = session.email;
    projectId = session.projectId;
    await seedSandLogisticsNetwork(ctx, session.csrf, session.projectId);
    await ctx.dispose();
  });

  test('logistics tab loads analyze action', async ({ page }) => {
    await loginViaUi(page, email);

    await page.goto(`/logistics/schematic/${projectId}`);
    await expect(page).toHaveURL(new RegExp(`/logistics/schematic/${projectId}`));
    await expect(
      page.getByRole('button', { name: /Рассчитать логистику песка/i }),
    ).toBeVisible();
  });

  test('analyze sand logistics from UI', async ({ page }) => {
    await loginViaUi(page, email);

    await page.goto(`/logistics/schematic/${projectId}`);

    await page.getByRole('button', { name: /Рассчитать логистику песка/i }).click();
    await expect(page.getByText(/подсетей с карьерами/i)).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(/рассчитано:/i)).toBeVisible();
  });

  test('logistics page scrolls in app-main', async ({ page }) => {
    await loginViaUi(page, email);

    await page.goto(`/logistics/schematic/${projectId}`);
    await expect(page).toHaveURL(new RegExp(`/logistics/schematic/${projectId}`));

    await expectAppMainScrollable(page);
  });

  test('timeline year slider changes view slice', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginViaUi(page, email);
    await page.goto(`/logistics/schematic/${projectId}`);

    await page.getByRole('button', { name: /Рассчитать логистику песка/i }).click();
    await expect(page.getByText(/подсеть с карьерами/i)).toBeVisible({ timeout: 90_000 });

    const badge = page.locator('.sand-logistics-timeline__badge');
    await expect(badge).toBeVisible({ timeout: 15_000 });
    const before = await badge.textContent();

    const stepNext = page.getByRole('button', { name: 'Следующий год' });
    await expect(stepNext).toBeEnabled({ timeout: 15_000 });
    await stepNext.click();
    await expect(badge).not.toHaveText(before ?? '');
  });
});

