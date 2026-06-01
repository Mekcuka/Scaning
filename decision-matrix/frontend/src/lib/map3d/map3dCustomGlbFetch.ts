/** Authenticated fetch for per-project GLB files (cross-origin GitHub Pages → API). */

import { getAccessToken } from '../authSession';

export function isProjectCustomGlbFileUrl(url: string): boolean {
  return url.includes('/map3d-custom-models/') && url.endsWith('/file');
}

export async function fetchProjectCustomGlbBlob(url: string): Promise<Blob> {
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    credentials: 'include',
    headers,
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Не удалось загрузить GLB (${res.status})`);
  }
  return res.blob();
}
