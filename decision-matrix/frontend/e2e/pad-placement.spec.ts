import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  cleanupE2eProjects,
  enableMapEdit,
  fitMapToAllObjects,
  loginViaApi,
  loginViaUi,
  openMapPage,
  seedPadPlacementBottomholes,
  setupE2eSession,
  type CsrfHolder,
} from './helpers';

test.describe('Pad placement (map)', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  let email: string;
  let projectId: string;

  test.beforeAll(async ({ playwright }) => {
    const ctx = await playwright.request.newContext();
    const session = await setupE2eSession(ctx, 'pad_placement');
    email = session.email;
    projectId = session.projectId;
    await ctx.dispose();
  });

  test.afterAll(async ({ playwright }) => {
    const ctx = await playwright.request.newContext();
    const csrf = await loginViaApi(ctx, email);
    await cleanupE2eProjects(ctx, csrf, [projectId]);
    await ctx.dispose();
  });

  async function apiCsrf(request: APIRequestContext): Promise<CsrfHolder> {
    return loginViaApi(request, email);
  }

  test('compute pad placement variants and apply on map', async ({ page, request }) => {
    const csrf = await apiCsrf(request);
    await seedPadPlacementBottomholes(request, csrf, projectId, 3);

    await loginViaUi(page, email);
    await openMapPage(page, projectId);
    await enableMapEdit(page);
    await fitMapToAllObjects(page);

    await page.getByRole('button', { name: 'Оптимизация кустов' }).click();
    const panel = page.getByRole('region', { name: 'Оптимизация размещения кустов' });
    await expect(panel).toBeVisible({ timeout: 15_000 });

    await panel.getByRole('button', { name: /Видимые \(\d+\)/ }).click();
    await expect(panel.getByText('готово к расчёту')).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByRole('button', { name: /Забои \d+/ })).toBeVisible();

    const computePromise = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        r.url().includes('/pad-placement/compute') &&
        !r.url().includes('async=true') &&
        r.status() === 200,
      { timeout: 90_000 },
    );
    await panel.getByRole('button', { name: 'Рассчитать', exact: true }).click();
    const computeRes = await computePromise;
    const computeBody = (await computeRes.json()) as {
      variants?: Array<{ invalid?: boolean; pad_count?: number }>;
    };
    expect(computeBody.variants?.length ?? 0).toBeGreaterThan(0);
    expect(computeBody.variants?.[0]?.invalid).toBe(false);

    await expect(panel.getByText('Варианты')).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByRole('button', { name: 'Применить' })).toBeEnabled({ timeout: 15_000 });

    const applyPromise = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        r.url().includes('/pad-placement/apply') &&
        (r.status() === 200 || r.status() === 202),
      { timeout: 90_000 },
    );
    await panel.getByRole('button', { name: 'Применить' }).click();
    const applyRes = await applyPromise;
    expect([200, 202]).toContain(applyRes.status());

    if (applyRes.status() === 200) {
      const applied = (await applyRes.json()) as { created_pad_ids?: string[] };
      expect(applied.created_pad_ids?.length ?? 0).toBeGreaterThan(0);
    }

    await expect(panel).toBeHidden({ timeout: 15_000 });
  });
});
