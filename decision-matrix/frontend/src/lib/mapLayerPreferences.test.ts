import { describe, expect, it, beforeEach } from 'vitest';
import {
  defaultMapLayerPreferences,
  loadMapLayerPreferences,
  saveMapLayerPreferences,
} from './mapLayerPreferences';

describe('mapLayerPreferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips toggles per project', () => {
    const p1 = defaultMapLayerPreferences();
    p1.showBasemap = false;
    p1.showRadii = true;
    p1.subtypeFilter.gas_processing = false;
    p1.openSections.objects = true;
    saveMapLayerPreferences('proj-a', p1);

    const loaded = loadMapLayerPreferences('proj-a');
    expect(loaded.showBasemap).toBe(false);
    expect(loaded.showRadii).toBe(true);
    expect(loaded.subtypeFilter.gas_processing).toBe(false);
    expect(loaded.openSections.objects).toBe(true);
  });

  it('defaults map3dQuality to balanced', () => {
    expect(defaultMapLayerPreferences().map3dQuality).toBe('balanced');
  });

  it('keeps separate storage per project id', () => {
    const a = defaultMapLayerPreferences();
    a.showModels = false;
    saveMapLayerPreferences('a', a);

    const b = defaultMapLayerPreferences();
    b.showModels = true;
    saveMapLayerPreferences('b', b);

    expect(loadMapLayerPreferences('a').showModels).toBe(false);
    expect(loadMapLayerPreferences('b').showModels).toBe(true);
  });
});
