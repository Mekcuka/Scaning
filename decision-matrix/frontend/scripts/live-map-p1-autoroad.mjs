/**
 * Live smoke: login, open /map with project P1, call plan API from page context.
 * Run: node scripts/live-map-p1-autoroad.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.PW_BASE_URL || 'http://127.0.0.1:5173';
const API = 'http://127.0.0.1:8000/api/v1';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const logs = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') logs.push(`console: ${msg.text()}`);
  });

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.fill('input[type="email"]', 'admin@oilgas.ru');
  await page.fill('input[type="password"]', 'admin1234');
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 30_000 });

  await page.goto(`${BASE}/map`, { waitUntil: 'networkidle', timeout: 60_000 });

  const projectLabel = await page
    .locator('select, [role="combobox"]')
    .first()
    .inputValue()
    .catch(() => null);

  const planResult = await page.evaluate(async (apiBase) => {
    const token = localStorage.getItem('access_token');
    const csrf = sessionStorage.getItem('csrf_token') || '';
    const projectsRes = await fetch(`${apiBase}/projects`, {
      headers: { Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrf },
      credentials: 'include',
    });
    const projects = await projectsRes.json();
    const p1 =
      projects.find((p) => p.name === 'P1') ||
      projects.find((p) => /^[P\u0420]1$/u.test((p.name || '').trim()));
    if (!p1) return { error: 'P1 not in project list', projects: projects.map((x) => x.name) };

    const objsRes = await fetch(
      `${apiBase}/projects/${p1.id}/infrastructure/objects?visible_layers_only=false`,
      {
        headers: { Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrf },
        credentials: 'include',
      },
    );
    const objs = await objsRes.json();
    const excluded = new Set(['node', 'methanol_joint', 'power_line_node']);
    const ids = objs
      .filter((o) => o.subtype && !excluded.has(o.subtype) && !o.end_longitude)
      .map((o) => o.id)
      .slice(0, 6);
    if (ids.length < 2) {
      return { error: 'fewer than 2 terminals', project: p1.name, ids, total: objs.length };
    }
    const planRes = await fetch(`${apiBase}/projects/${p1.id}/autoroad-network/plan`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
      },
      credentials: 'include',
      body: JSON.stringify({ object_ids: ids, dry_run: true }),
    });
    const body = await planRes.json().catch(() => ({}));
    return {
      project: p1.name,
      projectId: p1.id,
      terminalIds: ids,
      status: planRes.status,
      new_line_count: body.new_line_count,
      new_node_count: body.new_node_count,
      total_new_km: body.total_new_km,
      warnings: body.warnings,
      terminals: body.terminals,
    };
  }, API);

  console.log(JSON.stringify({ projectLabel, planResult, consoleErrors: logs }, null, 2));
  await browser.close();
  if (planResult.error || planResult.status !== 200) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
