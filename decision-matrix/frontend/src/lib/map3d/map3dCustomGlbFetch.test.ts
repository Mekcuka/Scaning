import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchProjectCustomGlbBlob, isProjectCustomGlbFileUrl } from './map3dCustomGlbFetch';

describe('map3dCustomGlbFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('detects project custom GLB file URLs', () => {
    expect(
      isProjectCustomGlbFileUrl(
        'https://api.example/api/v1/projects/p1/map3d-custom-models/m1/file',
      ),
    ).toBe(true);
    expect(isProjectCustomGlbFileUrl('https://pages.example/Scaning/map3d-models/tank.glb')).toBe(
      false,
    );
  });

  it('sends Bearer token and bypasses cache for custom GLB', async () => {
    sessionStorage.setItem('access_token', 'test-jwt');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['glb'], { type: 'model/gltf-binary' })),
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchProjectCustomGlbBlob(
      'https://api.example/api/v1/projects/p1/map3d-custom-models/m1/file',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example/api/v1/projects/p1/map3d-custom-models/m1/file',
      expect.objectContaining({
        credentials: 'include',
        cache: 'no-store',
        headers: { Authorization: 'Bearer test-jwt' },
      }),
    );
  });
});
