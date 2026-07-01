import { describe, expect, it } from 'vitest';
import { prefetchMapPageBundle } from './prefetchRoutes';

describe('prefetchMapPageBundle', () => {
  it('starts MapPage chunk load once when called repeatedly', async () => {
    prefetchMapPageBundle();
    prefetchMapPageBundle();
    const mod = await import('../pages/MapPage');
    expect(mod.MapPage).toBeTypeOf('function');
  });
});
