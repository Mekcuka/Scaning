/**
 * Capture 2D/3D map screenshots for line-inversion QA.
 * Prereq: backend :8000, frontend :5173 (npm run dev).
 * Run: node scripts/capture-line-inversion-screenshots.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../../../docs/screenshots/line-inversion-qa');
mkdirSync(OUT, { recursive: true });

const BASE = process.env.MAP_SCREENSHOT_BASE ?? 'http://127.0.0.1:5173';
const CENTER = { centerLon: 37.615, centerLat: 55.755, zoom: 13 };

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'ru-RU',
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#login-email', { timeout: 60000 });
  await page.locator('#login-email').fill('engineer@oilgas.ru');
  await page.locator('#login-password').fill('password123');
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });

  const projects = await page.evaluate(async () => {
    const res = await fetch('/api/v1/projects', { credentials: 'include' });
    if (!res.ok) return [];
    return res.json();
  });
  const project =
    projects.find((p) => p.name?.includes('Запад')) ?? projects[0] ?? null;
  const projectId = project?.id ?? null;

  if (projectId) {
    await page.evaluate(
      ({ id, center }) => {
        localStorage.setItem('currentProjectId', id);
        localStorage.setItem(
          `dm-map-view-3d:main:${id}`,
          JSON.stringify({ ...center, pitch: 0, bearing: 0 }),
        );
        localStorage.setItem(`dm-map-view:main:${id}`, JSON.stringify(center));
      },
      { id: projectId, center: CENTER },
    );
  }

  await page.goto(`${BASE}/map`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.map-main-column', { timeout: 30000 });
  await page.waitForTimeout(4000);

  const mapCol = page.locator('.map-main-column');
  await mapCol.screenshot({ path: path.join(OUT, '01-map-2d-plan.png') });

  const btn3d = page.getByRole('button', { name: 'Карта 3D' });
  if (await btn3d.isVisible().catch(() => false)) {
    await btn3d.click();
    await page.waitForTimeout(6000);
    await mapCol.screenshot({ path: path.join(OUT, '02-map-3d-pitch0.png') });

    const pitchUp = page.locator('.maplibregl-ctrl-pitchup');
    for (let i = 0; i < 8; i++) {
      if (await pitchUp.isVisible().catch(() => false)) await pitchUp.click();
    }
    await page.waitForTimeout(2500);
    await mapCol.screenshot({ path: path.join(OUT, '03-map-3d-pitch55.png') });
  } else {
    await page.screenshot({ path: path.join(OUT, '02-3d-toggle-missing.png'), fullPage: true });
  }

  await browser.close();
  console.log('Screenshots saved to:', OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
