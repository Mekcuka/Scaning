import { describe, expect, it } from 'vitest';

describe('useMapPageMapActions module layout', () => {
  it('exports compose hook and action submodules', async () => {
    const main = await import('../useMapPageMapActions');
    const autoroad = await import('../actions/useMapAutoroadActions');
    const draw = await import('../actions/useMapDrawAndCreateActions');
    const selection = await import('../actions/useMapSelectionActions');
    const analysis = await import('../actions/useMapAnalysisActions');
    const display = await import('../actions/useMapDisplayActions');
    const interaction = await import('../actions/useMapPageInteraction');

    const lineProfile = await import('../actions/useMapLineElevationProfileActions');

    expect(typeof main.useMapPageMapActions).toBe('function');
    expect(typeof lineProfile.useMapLineElevationProfileActions).toBe('function');
    expect(typeof autoroad.useMapAutoroadActions).toBe('function');
    expect(typeof draw.useMapDrawAndCreateActions).toBe('function');
    expect(typeof selection.useMapSelectionActions).toBe('function');
    expect(typeof analysis.useMapAnalysisActions).toBe('function');
    expect(typeof display.useMapDisplayActions).toBe('function');
    expect(typeof interaction.useMapPageInteraction).toBe('function');
  });
});
