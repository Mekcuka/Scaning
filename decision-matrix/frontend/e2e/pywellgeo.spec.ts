import { test, expect } from '@playwright/test';
import {
  API,
  createInfraPoint,
  createLayer,
  createProject,
  loginViaApi,
  setupE2eSession,
} from './helpers';

test.describe('PyWellGeo tab smoke', () => {
  test.describe.configure({ mode: 'serial', timeout: 90_000 });

  let email: string;

  test.beforeAll(async ({ playwright }) => {
    const ctx = await playwright.request.newContext();
    const session = await setupE2eSession(ctx, 'pywellgeo');
    email = session.email;
    await ctx.dispose();
  });

  test('API: pywellgeo last + azim-dip on pad', async ({ request }) => {
    const csrf = await loginViaApi(request, email);
    const projectId = await createProject(request, csrf, `e2e_pywellgeo_${Date.now()}`);
    const layerId = await createLayer(request, csrf, projectId);
    const padId = await createInfraPoint(request, csrf, projectId, {
      layerId,
      subtype: 'oil_pad',
      name: 'E2E_PyWellGeo',
      lon: 37.62,
      lat: 55.76,
    });

    const lastRes = await request.get(
      `${API}/api/v1/projects/${projectId}/infrastructure/objects/${padId}/pywellgeo/last`,
      { headers: { 'X-CSRF-Token': csrf.token } },
    );
    expect(lastRes.ok(), await lastRes.text()).toBeTruthy();
    const last = await lastRes.json();
    expect(last.settings.default_radius_m).toBeGreaterThan(0);

    const azimRes = await request.post(
      `${API}/api/v1/projects/${projectId}/infrastructure/objects/${padId}/pywellgeo/azim-dip/convert`,
      {
        headers: { 'X-CSRF-Token': csrf.token },
        data: { mode: 'azim_dip_to_vector', azim_deg: 45, dip_deg: 30 },
      },
    );
    expect(azimRes.ok(), await azimRes.text()).toBeTruthy();
    const azim = await azimRes.json();
    expect(Array.isArray(azim.vector)).toBeTruthy();

    const tree = {
      x: 0,
      y: 0,
      z: 0,
      radius: 0.10795,
      perforated: false,
      color: 'black',
      name: 'main',
      branches: [
        {
          x: 0,
          y: 0,
          z: -100,
          radius: 0.10795,
          perforated: false,
          color: 'black',
          name: 'main',
          branches: [],
        },
      ],
    };

    const plotRes = await request.post(
      `${API}/api/v1/projects/${projectId}/infrastructure/objects/${padId}/pywellgeo/plot-data`,
      {
        headers: { 'X-CSRF-Token': csrf.token },
        data: { well_index: 0, tree },
      },
    );
    expect(plotRes.ok(), await plotRes.text()).toBeTruthy();
    const plot = await plotRes.json();
    expect(Array.isArray(plot.segments)).toBeTruthy();

    const coarseRes = await request.post(
      `${API}/api/v1/projects/${projectId}/infrastructure/objects/${padId}/pywellgeo/tree/coarsen`,
      {
        headers: { 'X-CSRF-Token': csrf.token },
        data: { well_index: 0, tree, segment_length_m: 50 },
      },
    );
    expect(coarseRes.ok(), await coarseRes.text()).toBeTruthy();
  });
});
