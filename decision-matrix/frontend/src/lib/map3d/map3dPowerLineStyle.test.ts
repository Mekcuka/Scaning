import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  createPowerLineGlowMaterial,
  createPowerLineMetalMaterial,
  POWER_LINE_GLOW_COLOR,
  POWER_LINE_METAL_COLOR,
} from './map3dPowerLineStyle';

describe('map3dPowerLineStyle', () => {
  it('uses metallic steel and green emissive', () => {
    const metal = createPowerLineMetalMaterial(false);
    expect(metal.metalness).toBeGreaterThan(0.8);
    expect(metal.color.getHexString()).toBe(
      new THREE.Color(POWER_LINE_METAL_COLOR).getHexString(),
    );

    const glow = createPowerLineGlowMaterial(false);
    expect(glow.emissiveIntensity).toBeGreaterThan(0.5);
    expect(glow.emissive.getHexString()).toBe(
      new THREE.Color(POWER_LINE_GLOW_COLOR).getHexString(),
    );
  });
});
