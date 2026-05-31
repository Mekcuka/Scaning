import { expect, type APIRequestContext, type Page } from '@playwright/test';

const API = process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:8000';

/** Register + login via API; Playwright request context keeps auth cookies. */
export async function registerAndLogin(
  request: APIRequestContext,
  email: string,
  username: string,
): Promise<string> {
  const register = await request.post(`${API}/api/v1/auth/register`, {
    data: { email, password: 'password1', username },
  });
  expect(register.ok(), `register failed: ${register.status()} ${await register.text()}`).toBeTruthy();

  const login = await request.post(`${API}/api/v1/auth/login`, {
    data: { email, password: 'password1' },
  });
  expect(login.ok(), `login failed: ${login.status()} ${await login.text()}`).toBeTruthy();

  const csrf = login.headers()['x-csrf-token'];
  expect(csrf, 'missing X-CSRF-Token on login').toBeTruthy();
  return csrf!;
}

export async function createProject(
  request: APIRequestContext,
  csrf: string,
  name: string,
): Promise<string> {
  const res = await request.post(`${API}/api/v1/projects`, {
    headers: { 'X-CSRF-Token': csrf },
    data: { name },
  });
  expect(res.ok(), `createProject failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = await res.json();
  return body.id as string;
}

export async function loginViaUi(page: Page, email: string, password = 'password1'): Promise<void> {
  await page.goto('/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: /войти/i }).click();
  await page.waitForURL(/\/(dashboard)?$/);
}
