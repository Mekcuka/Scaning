import { test, expect } from '@playwright/test';
import {
  loginViaApi,
  loginViaUi,
  seedSandLogisticsNetwork,
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

    await page.goto(`/flows/logistics/${projectId}`);
    await expect(page).toHaveURL(new RegExp(`/flows/logistics/${projectId}`));
    await expect(
      page.getByRole('button', { name: /Рассчитать логистику песка/i }),
    ).toBeVisible();
  });

  test('analyze sand logistics from UI', async ({ page }) => {
    await loginViaUi(page, email);

    await page.goto(`/flows/logistics/${projectId}`);

    await page.getByRole('button', { name: /Рассчитать логистику песка/i }).click();
    await expect(page.getByText(/подсетей с карьерами/i)).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(/рассчитано:/i)).toBeVisible();
  });

  test('logistics page scrolls in app-main', async ({ page }) => {
    await loginViaUi(page, email);

    await page.goto(`/flows/logistics/${projectId}`);
    await expect(page).toHaveURL(new RegExp(`/flows/logistics/${projectId}`));

    const main = page.locator('.app-main');
    await expect(main).toBeVisible();
    const canScroll = await main.evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(canScroll).toBe(true);
    await main.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    expect(await main.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  });

  test('timeline year slider changes view slice', async ({ page }) => {
    await loginViaUi(page, email);
    await page.goto(`/flows/logistics/${projectId}`);

    await expect(page.getByText(/подсетей с карьерами/i)).toBeVisible({ timeout: 20_000 });

    const slider = page.getByRole('slider', { name: 'Год среза для схемы' });
    await expect(slider).toBeVisible({ timeout: 15_000 });

    const before = await page.locator('.sand-logistics-timeline__badge').textContent();
    await slider.fill('0');
    await expect(page.locator('.sand-logistics-timeline__badge')).not.toHaveText(before ?? '');
  });
});

