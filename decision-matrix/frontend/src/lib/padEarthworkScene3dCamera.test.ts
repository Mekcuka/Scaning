import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  frameScene3dCamera,
  orbitScene3dCamera,
  scene3dCameraZoomPercent,
  scene3dToolbarZoomIn,
  scene3dToolbarZoomOut,
  zoomScene3dCamera,
} from './padEarthworkScene3dCamera';

function mockScene(root: THREE.Object3D) {
  const camera = new THREE.PerspectiveCamera(42, 1.6, 0.1, 800);
  const target = new THREE.Vector3();
  const controls = {
    target,
    minDistance: 1,
    maxDistance: 500,
    update: () => {},
  };
  return { camera, controls, root };
}

describe('padEarthworkScene3dCamera', () => {
  it('frames camera around scene bounds', () => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(40, 4, 30)));
    const { camera, controls } = mockScene(root);
    const distance = frameScene3dCamera(camera, controls, root);
    expect(distance).not.toBeNull();
    expect(camera.position.distanceTo(controls.target)).toBeGreaterThan(10);
  });

  it('zoom in/out changes camera distance', () => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(20, 2, 20)));
    const { camera, controls } = mockScene(root);
    frameScene3dCamera(camera, controls, root);
    const before = camera.position.distanceTo(controls.target);
    scene3dToolbarZoomIn(camera, controls);
    const afterIn = camera.position.distanceTo(controls.target);
    expect(afterIn).toBeLessThan(before);
    scene3dToolbarZoomOut(camera, controls);
    const afterOut = camera.position.distanceTo(controls.target);
    expect(afterOut).toBeGreaterThan(afterIn);
  });

  it('reports zoom percent relative to baseline distance', () => {
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 800);
    const controls = {
      target: new THREE.Vector3(0, 0, 0),
      minDistance: 1,
      maxDistance: 500,
      update: () => {},
    };
    camera.position.set(0, 0, 100);
    expect(scene3dCameraZoomPercent(camera, controls, 100)).toBe(100);
    zoomScene3dCamera(camera, controls, 0.5);
    expect(scene3dCameraZoomPercent(camera, controls, 100)).toBe(200);
  });

  it('orbits camera around target', () => {
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 800);
    const controls = {
      target: new THREE.Vector3(0, 0, 0),
      minDistance: 1,
      maxDistance: 500,
      update: () => {},
    };
    camera.position.set(50, 20, 0);
    const before = camera.position.x;
    orbitScene3dCamera(camera, controls, Math.PI / 2);
    expect(Math.abs(camera.position.x - before)).toBeGreaterThan(1);
    expect(camera.position.distanceTo(controls.target)).toBeCloseTo(53.85, 0);
  });
});
