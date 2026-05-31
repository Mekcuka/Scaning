import type { APIRequestContext } from '@playwright/test';

const API = process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:8000';

export async function registerAndLogin(
  request: APIRequestContext,
  email: string,
  username: string,
): Promise<{ csrf: string; cookies: string }> {
  await request.post(`${API}/api/v1/auth/register`, {
    data: { email, password: 'password1', username },
  });
  const login = await request.post(`${API}/api/v1/auth/login`, {
    data: { email, password: 'password1' },
  });
  const headers = login.headers();
  const setCookie = headers['set-cookie'] ?? '';
  const csrfMatch = setCookie.match(/csrf_token=([^;]+)/);
  const csrf = csrfMatch?.[1] ?? '';
  return { csrf, cookies: setCookie };
}

export async function createProject(
  request: APIRequestContext,
  csrf: string,
  cookies: string,
  name: string,
): Promise<string> {
  const res = await request.post(`${API}/api/v1/projects`, {
    headers: {
      'X-CSRF-Token': csrf,
      Cookie: cookies,
    },
    data: { name },
  });
  const body = await res.json();
  return body.id as string;
}
