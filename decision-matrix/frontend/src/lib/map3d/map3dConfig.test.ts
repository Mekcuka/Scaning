import { afterEach, describe, expect, it, vi } from 'vitest';
import { isMap3dEnabled } from './map3dConfig';

describe('isMap3dEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is true when env unset (GitHub Pages default)', () => {
    vi.stubEnv('VITE_MAP_3D_ENABLED', undefined);
    expect(isMap3dEnabled()).toBe(true);
  });

  it('is true for explicit true', () => {
    vi.stubEnv('VITE_MAP_3D_ENABLED', 'true');
    expect(isMap3dEnabled()).toBe(true);
  });

  it('is false when explicitly disabled', () => {
    vi.stubEnv('VITE_MAP_3D_ENABLED', 'false');
    expect(isMap3dEnabled()).toBe(false);
  });
});
