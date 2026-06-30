import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  API,
  createInfraPoint,
  createLayer,
  createProject,
  loginViaApi,
  loginViaUi,
  setupE2eSession,
  type CsrfHolder,
} from './helpers';

async function patchPadSketch(
  request: APIRequestContext,
  csrf: CsrfHolder,
  projectId: string,
  padId: string,
  wellCount: number,
) {
  const wellsLocal = Array.from({ length: wellCount }, (_, i) => ({
    east_m: i * 9,
    north_m: 0,
  }));
  const res = await request.patch(
    `${API}/api/v1/projects/${projectId}/infrastructure/objects/${padId}/pad-earthwork/sketch`,
    {
      headers: { 'X-CSRF-Token': csrf.token },
      data: {
        sketch: {
          kind: 'plan_rectangle',
          length_m: 120,
          width_m: 80,
          rotation_deg: 90,
        },
        params: { height_m: 2.0, reference_elevation_m: 150.0 },
        wells_local: wellsLocal,
      },
    },
  );
  expect(res.ok(), await res.text()).toBeTruthy();
}

test.describe('Well trajectory M2 smoke', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  let email: string;

  test.beforeAll(async ({ playwright }) => {
    const ctx = await playwright.request.newContext();
    const session = await setupE2eSession(ctx, 'well_trajectory');
    email = session.email;
    await ctx.dispose();
  });

  test('API: bottomhole sync + design-from-bottomholes + geojson', async ({ request }) => {
    const csrf = await loginViaApi(request, email);
    const projectId = await createProject(request, csrf, `e2e_well_traj_${Date.now()}`);
    const layerId = await createLayer(request, csrf, projectId);
    const padId = await createInfraPoint(request, csrf, projectId, {
      layerId,
      name: 'E2E Куст WT',
      subtype: 'oil_pad',
      lon: 37.62,
      lat: 55.76,
    });

    await patchPadSketch(request, csrf, projectId, padId, 2);

    let res = await request.post(
      `${API}/api/v1/projects/${projectId}/infrastructure/objects/${padId}/well-trajectory/generate-from-layout`,
      { headers: { 'X-CSRF-Token': csrf.token } },
    );
    expect(res.ok(), await res.text()).toBeTruthy();

    await createInfraPoint(request, csrf, projectId, {
      layerId,
      name: 'E2E Забой',
      subtype: 'well_bottomhole_nnb',
      lon: 37.6205,
      lat: 55.7605,
      properties: {
        well_bottomhole_linked_pad_id: padId,
        well_bottomhole_well_index: 0,
        well_bottomhole_tvd_m: 1500,
      },
    });

    res = await request.post(
      `${API}/api/v1/projects/${projectId}/infrastructure/objects/${padId}/well-trajectory/sync-bottomholes`,
      { headers: { 'X-CSRF-Token': csrf.token } },
    );
    expect(res.ok(), await res.text()).toBeTruthy();

    res = await request.post(
      `${API}/api/v1/projects/${projectId}/infrastructure/objects/${padId}/well-trajectory/design-from-bottomholes`,
      {
        headers: { 'X-CSRF-Token': csrf.token },
        data: { step_m: 30 },
      },
    );
    expect(res.ok(), await res.text()).toBeTruthy();
    const designed = await res.json();
    expect(designed.designed?.length ?? 0).toBeGreaterThan(0);

    res = await request.get(
      `${API}/api/v1/projects/${projectId}/infrastructure/objects/${padId}/well-trajectory/geojson`,
      { headers: { 'X-CSRF-Token': csrf.token } },
    );
    expect(res.ok(), await res.text()).toBeTruthy();
    const geo = await res.json();
    expect(geo.features?.length ?? 0).toBeGreaterThan(0);
  });

  test('UI: pad-clustering design pipeline', async ({ page, request }) => {
    const csrf = await loginViaApi(request, email);
    const projectId = await createProject(request, csrf, `e2e_well_traj_ui_${Date.now()}`);
    const layerId = await createLayer(request, csrf, projectId);
    const padId = await createInfraPoint(request, csrf, projectId, {
      layerId,
      name: 'E2E Куст UI',
      subtype: 'oil_pad',
      lon: 37.63,
      lat: 55.77,
    });
    await patchPadSketch(request, csrf, projectId, padId, 2);
    await request.post(
      `${API}/api/v1/projects/${projectId}/infrastructure/objects/${padId}/well-trajectory/generate-from-layout`,
      { headers: { 'X-CSRF-Token': csrf.token } },
    );
    await createInfraPoint(request, csrf, projectId, {
      layerId,
      name: 'E2E BH UI',
      subtype: 'well_bottomhole_nnb',
      lon: 37.6305,
      lat: 55.7705,
      properties: {
        well_bottomhole_linked_pad_id: padId,
        well_bottomhole_well_index: 0,
        well_bottomhole_tvd_m: 1500,
      },
    });

    await loginViaUi(page, email);
    await page.goto(`/pad-clustering/workspace/${projectId}`);
    await expect(page.getByRole('heading', { name: 'Кустование' })).toBeVisible({ timeout: 20_000 });

    const padSelect = page.getByRole('combobox', { name: 'Кустовая площадка' });
    await padSelect.click();
    await page.getByRole('option', { name: 'E2E Куст UI' }).click();

    await page.getByRole('button', { name: 'Рассчитать', exact: true }).click();
    await expect(page.getByText(/постр\./i)).toBeVisible({ timeout: 30_000 });
  });
});
