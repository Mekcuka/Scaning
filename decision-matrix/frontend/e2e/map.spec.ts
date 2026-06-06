import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  clickMapLonLat,
  createInfraPoint,
  createLayer,
  createProject,
  enableMapEdit,
  hoverMapLonLat,
  fitMapToAllObjects,
  loginViaApi,
  loginViaUi,
  openMapPage,
  setupE2eSession,
  waitForInfraObjectCreate,
  type CsrfHolder,
} from './helpers';

test.describe('Map', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  let email: string;
  let defaultProjectId: string;

  test.beforeAll(async ({ playwright }) => {
    const ctx = await playwright.request.newContext();
    const session = await setupE2eSession(ctx, 'map');
    email = session.email;
    defaultProjectId = session.projectId;
    await ctx.dispose();
  });

  async function apiCsrf(request: APIRequestContext): Promise<CsrfHolder> {
    return loginViaApi(request, email);
  }

  test('map page loads in 2D mode', async ({ page }) => {
    await loginViaUi(page, email);
    await openMapPage(page, defaultProjectId);
  });

  test('draw autoroad line on map', async ({ page, request }) => {
    const csrf = await apiCsrf(request);
    const projectId = await createProject(request, csrf, `test_map_line_${Date.now()}`);
    const layerId = await createLayer(request, csrf, projectId);
    await createInfraPoint(request, csrf, projectId, {
      layerId,
      name: 'E2E Узел A',
      subtype: 'gas_processing',
      lon: 37.6,
      lat: 55.75,
    });
    await createInfraPoint(request, csrf, projectId, {
      layerId,
      name: 'E2E Узел B',
      subtype: 'gas_processing',
      lon: 37.61,
      lat: 55.76,
    });

    await loginViaUi(page, email);
    const viewport = await openMapPage(page, projectId);
    await enableMapEdit(page);
    await fitMapToAllObjects(page);

    await page.getByRole('button', { name: 'Линия' }).click();
    await page.getByText('Автодорога', { exact: true }).click();
    await expect(page.getByText(/первая точка/i)).toBeVisible();

    await clickMapLonLat(page, viewport, 37.6, 55.75);
    await clickMapLonLat(page, viewport, 37.61, 55.76);
    await hoverMapLonLat(page, viewport, 37.61, 55.76);
    await page.waitForTimeout(200);

    const createPromise = waitForInfraObjectCreate(page, 'autoroad');
    await expect(page.getByRole('button', { name: 'Готово' })).toBeEnabled({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Готово' }).click();

    const createRes = await createPromise;
    expect((await createRes.json()).subtype).toBe('autoroad');
  });

  test('select infra object, save detail panel, ruler measurement', async ({ page, request }) => {
    const csrf = await apiCsrf(request);
    const projectId = await createProject(request, csrf, `test_map_save_${Date.now()}`);
    const layerId = await createLayer(request, csrf, projectId);
    await createInfraPoint(request, csrf, projectId, {
      layerId,
      name: 'E2E ГКС',
      subtype: 'gas_processing',
      lon: 37.6,
      lat: 55.75,
    });

    await loginViaUi(page, email);
    const viewport = await openMapPage(page, projectId);
    await enableMapEdit(page);
    await fitMapToAllObjects(page);

    await page.getByRole('button', { name: 'Один объект' }).click();
    await clickMapLonLat(page, viewport, 37.6, 55.75);
    await expect(page.getByRole('textbox', { name: 'Название объекта' })).toBeVisible({
      timeout: 15_000,
    });

    const patchPromise = page.waitForResponse(
      (r) =>
        r.request().method() === 'PATCH' &&
        r.url().includes('/infrastructure/objects/') &&
        r.status() === 200,
      { timeout: 20_000 },
    );
    await page.getByRole('textbox', { name: 'Название объекта' }).fill('E2E ГКС переименован');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    const patchRes = await patchPromise;
    expect((await patchRes.json()).name).toBe('E2E ГКС переименован');

    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Линейка' }).click();
    await clickMapLonLat(page, viewport, 37.617, 55.755);
    await page.waitForTimeout(400);
    await clickMapLonLat(page, viewport, 37.62, 55.758);
    await page.waitForTimeout(400);
    await expect(page.getByRole('button', { name: 'Готово' })).toBeEnabled({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Готово' }).click();
    await expect(page.locator('.measure-label').first()).toBeVisible({ timeout: 15_000 });
  });
});

