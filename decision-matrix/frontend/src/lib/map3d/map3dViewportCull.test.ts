import { describe, expect, it } from 'vitest';
import type { Map as MapLibreMap } from 'maplibre-gl';
import {
  clearViewportCullFreezeForMap,
  freezeViewportCullForMap,
  shouldApplyViewportCull,
  viewportLoadMarginDegForMap,
  viewportMarginDegForMap,
  viewportMarginDegForZoom,
} from './map3dViewportCull';

function fakeMap(zoom: number, moving = false): MapLibreMap {
  return {
    getZoom: () => zoom,
    isMoving: () => moving,
    getBounds: () => ({
      getWest: () => 37,
      getEast: () => 38,
      getSouth: () => 55,
      getNorth: () => 56,
    }),
  } as unknown as MapLibreMap;
}

describe('map3dViewportCull', () => {
  it('margin shrinks when zoomed in', () => {
    expect(viewportMarginDegForZoom(15)).toBeLessThan(viewportMarginDegForZoom(8));
  });

  it('load margin is wider than render margin', () => {
    const map = fakeMap(12);
    expect(viewportLoadMarginDegForMap(map)).toBeGreaterThan(viewportMarginDegForMap(map));
  });

  it('freezes margin zoom during camera animation', () => {
    const map = fakeMap(12);
    freezeViewportCullForMap(map);
    expect(viewportMarginDegForMap(map)).toBe(viewportMarginDegForZoom(12));

    (map as { getZoom: () => number }).getZoom = () => 8;
    expect(viewportMarginDegForMap(map)).toBe(viewportMarginDegForZoom(12));

    clearViewportCullFreezeForMap(map);
    expect(viewportMarginDegForMap(map)).toBe(viewportMarginDegForZoom(8));
  });

  it('shouldApplyViewportCull is false while map is moving', () => {
    const moving = fakeMap(12, true);
    const idle = fakeMap(12, false);
    expect(shouldApplyViewportCull(moving, true)).toBe(false);
    expect(shouldApplyViewportCull(idle, true)).toBe(true);
    expect(shouldApplyViewportCull(idle, false)).toBe(false);
  });
});
