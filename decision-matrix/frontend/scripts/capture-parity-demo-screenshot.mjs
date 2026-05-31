import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = path.resolve(__dirname, '../../../docs/screenshots/line-inversion-qa/parity-demo.html');
const out = path.resolve(__dirname, '../../../docs/screenshots/line-inversion-qa/00-plan-parity-demo.png');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 520 } });
await page.goto(`file:///${html.replace(/\\/g, '/')}`);
await page.waitForTimeout(500);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('Saved', out);
