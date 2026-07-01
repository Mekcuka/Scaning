import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DLS_DESIGN,
  WELL_TRAJECTORY_DLS_DESIGN,
  calcDraftFromSources,
  mergeCalcSettingsIntoProperties,
} from '../padClusteringCalcSettings';

describe('padClusteringCalcSettings', () => {
  it('reads dlsDesign from pad properties', () => {
    const draft = calcDraftFromSources({
      properties: { [WELL_TRAJECTORY_DLS_DESIGN]: 5.5 },
    });
    expect(draft.dlsDesign).toBe('5.5');
  });

  it('defaults dlsDesign to 3 when missing', () => {
    const draft = calcDraftFromSources({ properties: {} });
    expect(draft.dlsDesign).toBe(String(DEFAULT_DLS_DESIGN));
  });

  it('mergeCalcSettingsIntoProperties stores clamped dls_design', () => {
    const draft = calcDraftFromSources({ properties: {} });
    const merged = mergeCalcSettingsIntoProperties({}, { ...draft, dlsDesign: '45' });
    expect(merged[WELL_TRAJECTORY_DLS_DESIGN]).toBe(30);
  });
});
