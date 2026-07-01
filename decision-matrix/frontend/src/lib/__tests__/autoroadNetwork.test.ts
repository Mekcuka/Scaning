import { describe, expect, it } from 'vitest';
import { BOTTOMHOLE_CLUSTER_SUBTYPES } from '../api/infrastructureSubtypesManifest';
import {
  AUTOROAD_NETWORK_EXCLUDED_SUBTYPES,
  isAutoroadNetworkTerminal,
  isEligibleAutoroadTerminalObject,
} from '../autoroadNetwork';
import type { InfraObject } from '../api';

function point(subtype: string): InfraObject {
  return {
    id: 'obj-1',
    name: 'Test',
    subtype,
    lon: 37,
    lat: 55,
    category: 'well',
    properties: {},
  };
}

describe('autoroadNetwork', () => {
  it('excludes well bottomhole subtypes from terminals', () => {
    for (const subtype of BOTTOMHOLE_CLUSTER_SUBTYPES) {
      expect(AUTOROAD_NETWORK_EXCLUDED_SUBTYPES).toContain(subtype);
      expect(isAutoroadNetworkTerminal('infra', subtype)).toBe(false);
      expect(isEligibleAutoroadTerminalObject(point(subtype))).toBe(false);
    }
  });

  it('allows regular point terminals', () => {
    expect(isEligibleAutoroadTerminalObject(point('gas_processing'))).toBe(true);
    expect(isEligibleAutoroadTerminalObject(point('oil_pad'))).toBe(true);
  });
});
