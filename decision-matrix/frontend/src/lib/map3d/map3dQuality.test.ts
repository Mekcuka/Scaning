import { describe, expect, it } from 'vitest';
import {
  computeLineTubeSegmentCount,
  cullingEnabledForQuality,
  instancingEnabledForQuality,
  modelUsesFlatShading,
  modelUsesPolygonOffset,
  powerLineWireRadialForQuality,
  powerLineWireSegmentsForQuality,
  resolveModelRepresentation,
  tubeLengthStepMForQuality,
  tubeRadialSegmentsForQuality,
  tubeSegmentCapForQuality,
} from './map3dQuality';

describe('map3dQuality', () => {
  const sampleLenM = 120;

  it('tube caps follow preset', () => {
    expect(tubeSegmentCapForQuality('full')).toBe(64);
    expect(tubeSegmentCapForQuality('performance')).toBe(16);
  });

  it('line tube segments differ by preset (120 m sample)', () => {
    const full = computeLineTubeSegmentCount(sampleLenM, 'full');
    const perf = computeLineTubeSegmentCount(sampleLenM, 'performance');
    expect(full).toBeGreaterThan(perf);
  });

  it('power line wire segments differ by preset (120 m sample)', () => {
    const full = powerLineWireSegmentsForQuality(sampleLenM, 'full');
    const perf = powerLineWireSegmentsForQuality(sampleLenM, 'performance');
    expect(full).toBeGreaterThan(perf);
  });

  it('power line wire radial differs by preset', () => {
    expect(powerLineWireRadialForQuality('full')).toBeGreaterThan(
      powerLineWireRadialForQuality('performance'),
    );
  });

  it('tube length step coarsens on lower presets', () => {
    expect(tubeLengthStepMForQuality('full')).toBeLessThan(tubeLengthStepMForQuality('performance'));
  });

  it('tube radial segments shrink on lower presets', () => {
    expect(tubeRadialSegmentsForQuality(10, 'full')).toBe(10);
    expect(tubeRadialSegmentsForQuality(10, 'performance')).toBe(4);
  });

  it('viewport culling off on full, on for lighter presets', () => {
    expect(cullingEnabledForQuality('full')).toBe(false);
    expect(cullingEnabledForQuality('balanced')).toBe(true);
    expect(cullingEnabledForQuality('performance')).toBe(true);
  });

  it('instancing disabled until instanced path visual QA passes', () => {
    expect(instancingEnabledForQuality('full')).toBe(false);
    expect(instancingEnabledForQuality('balanced')).toBe(false);
    expect(instancingEnabledForQuality('performance')).toBe(false);
  });

  it('polygon offset disabled on all qualities', () => {
    expect(modelUsesPolygonOffset('full')).toBe(false);
    expect(modelUsesPolygonOffset('balanced')).toBe(false);
  });

  it('point models keep vertex palette on all presets', () => {
    expect(modelUsesFlatShading('performance')).toBe(false);
    expect(modelUsesFlatShading('full')).toBe(false);
    expect(modelUsesFlatShading('balanced')).toBe(false);
  });

  it('always keeps glTF when available', () => {
    expect(resolveModelRepresentation(10, 'performance', true)).toBe('gltf');
    expect(resolveModelRepresentation(12, 'balanced', false)).toBe('procedural');
  });
});
