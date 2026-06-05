import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';



export const API = process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:8000';



export type CsrfHolder = { token: string };



/** Register via API (issues session cookies on request context). */

export async function registerAndLogin(

  request: APIRequestContext,

  email: string,

  username: string,

): Promise<CsrfHolder> {

  const register = await request.post(`${API}/api/v1/auth/register`, {

    data: { email, password: 'password1', username },

  });

  expect(register.ok(), `register failed: ${register.status()} ${await register.text()}`).toBeTruthy();



  const csrf = register.headers()['x-csrf-token'];

  expect(csrf, 'missing X-CSRF-Token on register').toBeTruthy();

  return { token: csrf! };

}



export function nextCsrf(headers: Record<string, string>, fallback: string): string {

  return headers['x-csrf-token'] ?? fallback;

}



function applyCsrf(headers: Record<string, string>, csrf: CsrfHolder): void {

  csrf.token = nextCsrf(headers, csrf.token);

}



export async function createProject(

  request: APIRequestContext,

  csrf: CsrfHolder,

  name: string,

): Promise<string> {

  const res = await request.post(`${API}/api/v1/projects`, {

    headers: { 'X-CSRF-Token': csrf.token },

    data: { name },

  });

  expect(res.ok(), `createProject failed: ${res.status()} ${await res.text()}`).toBeTruthy();

  applyCsrf(res.headers(), csrf);

  const body = await res.json();

  return body.id as string;

}



export async function setupE2eSession(

  request: APIRequestContext,

  prefix: string,

): Promise<{ email: string; csrf: CsrfHolder; projectId: string }> {

  const email = `e2e-${prefix}-${Date.now()}@test.ru`;

  const csrf = await registerAndLogin(request, email, `E2E ${prefix}`);

  const projectId = await createProject(request, csrf, `test_${prefix}_${Date.now()}`);

  return { email, csrf, projectId };

}

/** Establish API session cookies on the current test request context. */
export async function loginViaApi(
  request: APIRequestContext,
  email: string,
  password = 'password1',
): Promise<CsrfHolder> {
  const res = await request.post(`${API}/api/v1/auth/login`, {
    data: { email, password },
  });
  expect(res.ok(), `login failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  const csrf: CsrfHolder = { token: '' };
  applyCsrf(res.headers(), csrf);
  const state = await request.storageState();
  const cookie = state.cookies.find((c) => c.name === 'csrf_token');
  if (cookie?.value) csrf.token = cookie.value;
  return csrf;
}

export async function createLayer(

  request: APIRequestContext,

  csrf: CsrfHolder,

  projectId: string,

  name = 'e2e_layer',

): Promise<string> {

  const res = await request.post(`${API}/api/v1/projects/${projectId}/infrastructure/layers`, {

    headers: { 'X-CSRF-Token': csrf.token },

    data: { name, layer_type: 'vector', source_type: 'manual' },

  });

  expect(res.ok(), `createLayer failed: ${res.status()} ${await res.text()}`).toBeTruthy();

  applyCsrf(res.headers(), csrf);

  const body = await res.json();

  return body.id as string;

}



export async function createInfraPoint(

  request: APIRequestContext,

  csrf: CsrfHolder,

  projectId: string,

  params: {

    layerId: string;

    name: string;

    subtype: string;

    lon: number;

    lat: number;

    properties?: Record<string, unknown>;

  },

): Promise<string> {

  const res = await request.post(`${API}/api/v1/projects/${projectId}/infrastructure/objects`, {

    headers: { 'X-CSRF-Token': csrf.token },

    data: {

      name: params.name,

      subtype: params.subtype,

      lon: params.lon,

      lat: params.lat,

      layer_id: params.layerId,

      properties: params.properties ?? {},

    },

  });

  expect(res.ok(), `createInfraPoint failed: ${res.status()} ${await res.text()}`).toBeTruthy();

  applyCsrf(res.headers(), csrf);

  const body = await res.json();

  return body.id as string;

}



export async function createInfraLine(

  request: APIRequestContext,

  csrf: CsrfHolder,

  projectId: string,

  params: {

    layerId: string;

    name: string;

    subtype: string;

    lon: number;

    lat: number;

    endLon: number;

    endLat: number;

  },

): Promise<string> {

  const res = await request.post(`${API}/api/v1/projects/${projectId}/infrastructure/objects`, {

    headers: { 'X-CSRF-Token': csrf.token },

    data: {

      name: params.name,

      subtype: params.subtype,

      lon: params.lon,

      lat: params.lat,

      end_lon: params.endLon,

      end_lat: params.endLat,

      layer_id: params.layerId,

    },

  });

  expect(res.ok(), `createInfraLine failed: ${res.status()} ${await res.text()}`).toBeTruthy();

  applyCsrf(res.headers(), csrf);

  const body = await res.json();

  return body.id as string;

}



/** Minimal sand network: quarry + consumer + autoroad, then analyze. */

export async function seedSandLogisticsNetwork(

  request: APIRequestContext,

  csrf: CsrfHolder,

  projectId: string,

): Promise<void> {

  const layerId = await createLayer(request, csrf, projectId, 'e2e_sand_layer');

  const quarryLon = 37.6;

  const quarryLat = 55.75;

  const padLon = 37.61;

  const padLat = 55.76;



  await createInfraPoint(request, csrf, projectId, {

    layerId,

    name: 'E2E Карьер',

    subtype: 'sand_quarry',

    lon: quarryLon,

    lat: quarryLat,

    properties: {

      entry_date: '2024-01-01',

      sand_volume_initial_m3: 500,

      sand_volume_current_m3: 500,

    },

  });



  await createInfraPoint(request, csrf, projectId, {

    layerId,

    name: 'E2E Куст',

    subtype: 'oil_pad',

    lon: padLon,

    lat: padLat,

    properties: {

      entry_date: '2025-01-01',

      sand_volume_mode: 'single',

      sand_volume_m3: 100,

    },

  });



  await createInfraLine(request, csrf, projectId, {

    layerId,

    name: 'E2E Дорога',

    subtype: 'autoroad',

    lon: quarryLon,

    lat: quarryLat,

    endLon: padLon,

    endLat: padLat,

  });



  const analyze = await request.post(`${API}/api/v1/projects/${projectId}/sand-logistics/analyze`, {

    headers: { 'X-CSRF-Token': csrf.token },

    data: { as_of: '2026-12-31' },

  });

  expect(analyze.ok(), `sand analyze failed: ${analyze.status()} ${await analyze.text()}`).toBeTruthy();

  applyCsrf(analyze.headers(), csrf);

}



export async function loginViaUi(page: Page, email: string, password = 'password1'): Promise<void> {
  await page.goto('/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: /войти/i }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15_000 });
}

export async function saveUiStorage(page: Page, storagePath: string): Promise<void> {
  await page.context().storageState({ path: storagePath });
}



export async function openMapPage(page: Page, projectId?: string): Promise<Locator> {

  const infraPromise = page.waitForResponse(

    (r) =>

      r.request().method() === 'GET' &&

      r.url().includes('/infrastructure/objects') &&

      r.status() === 200,

    { timeout: 30_000 },

  );

  const path = projectId ? `/map?project=${projectId}` : '/map';

  await page.goto(path);

  await expect(page).toHaveURL(/\/map/);

  const viewport = page.locator('.ol-viewport').first();

  await expect(viewport).toBeVisible({ timeout: 20_000 });

  await infraPromise;

  return viewport;

}



export async function enableMapEdit(page: Page): Promise<void> {

  await page.getByRole('button', { name: 'Включить редактирование на карте' }).click();

  await expect(

    page.getByRole('button', { name: 'Выключить редактирование на карте' }),

  ).toBeVisible();

}



export async function fitMapToAllObjects(page: Page): Promise<void> {

  await page.getByRole('button', { name: 'Показать все объекты' }).click();

  await page.waitForTimeout(600);

}



export async function clickMapLonLat(

  page: Page,

  viewport: Locator,

  lon: number,

  lat: number,

): Promise<void> {

  await page.waitForFunction(
    () => Boolean((window as Window & { __dmOlMap?: unknown }).__dmOlMap),
    { timeout: 15_000 },
  );

  const pos = await page.evaluate(([targetLon, targetLat]) => {

    const map = (window as Window & { __dmOlMap?: { getPixelFromCoordinate: (c: number[]) => number[] } })

      .__dmOlMap;

    if (!map) return null;

    const r = 6378137;

    const x = (targetLon * Math.PI * r) / 180;

    const y = Math.log(Math.tan(((90 + targetLat) * Math.PI) / 360)) * r;

    const pixel = map.getPixelFromCoordinate([x, y]);

    if (!pixel || !Number.isFinite(pixel[0]) || !Number.isFinite(pixel[1])) return null;

    return { x: pixel[0], y: pixel[1] };

  }, [lon, lat]);

  expect(pos, 'map pixel from __dmOlMap hook (set VITE_E2E_MAP_HOOK=true)').toBeTruthy();

  await viewport.click({

    position: pos!,

    force: true,

  });

}



export async function clickMapAt(

  viewport: Locator,

  offset: { x: number; y: number },

): Promise<void> {

  const box = await viewport.boundingBox();

  expect(box, 'map viewport bounding box').toBeTruthy();

  await viewport.click({

    position: {

      x: box!.width / 2 + offset.x,

      y: box!.height / 2 + offset.y,

    },

    force: true,

  });

}


