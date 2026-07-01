import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  cameraNorthCompassDeg,
  planWellheadWorldPosition,
  worldToOverlayPx,
} from '../padScene3dProjection';

describe('padScene3dProjection', () => {
  it('worldToOverlayPx returns null for zero canvas size', () => {
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    const world = new THREE.Vector3(0, 0, 0);
    expect(worldToOverlayPx(camera, 0, 600, world)).toBeNull();
    expect(worldToOverlayPx(camera, 800, 0, world)).toBeNull();
  });

  it('worldToOverlayPx returns finite coords for target in frame', () => {
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 0, 20);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);

    const px = worldToOverlayPx(camera, 800, 600, new THREE.Vector3(0, 0, 0));
    expect(px).not.toBeNull();
    expect(Number.isFinite(px!.x)).toBe(true);
    expect(Number.isFinite(px!.y)).toBe(true);
    expect(px!.x).toBeCloseTo(400, 0);
    expect(px!.y).toBeCloseTo(300, 0);
  });

  it('worldToOverlayPx returns null when point is behind camera', () => {
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);

    const behind = new THREE.Vector3(0, 0, 50);
    expect(worldToOverlayPx(camera, 800, 600, behind)).toBeNull();
  });

  it('planWellheadWorldPosition mirrors east into scene X', () => {
    const pos = planWellheadWorldPosition(12, 8, 100);
    expect(pos.x).toBe(-12);
    expect(pos.z).toBe(8);
    expect(pos.y).toBeGreaterThan(100);
  });

  it('cameraNorthCompassDeg is zero when plan view is locked', () => {
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(10, 20, 10);
    camera.lookAt(0, 0, 0);
    expect(cameraNorthCompassDeg(camera, new THREE.Vector3(), true)).toBe(0);
  });
});
