import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  applyInstanceMatrix,
  renderMap3dSceneOnce,
  type Map3dRenderItem,
} from './map3dLayerRender';

describe('map3dLayerRender', () => {
  it('applyInstanceMatrix copies matrix and disables auto update', () => {
    const group = new THREE.Group();
    const m = new THREE.Matrix4().makeTranslation(1, 2, 3);
    applyInstanceMatrix(group, m);
    expect(group.matrixAutoUpdate).toBe(false);
    expect(group.matrix.elements[12]).toBe(1);
  });

  it('renderMap3dSceneOnce renders opaque items in one pass', () => {
    const renderer = {
      resetState: vi.fn(),
      clearDepth: vi.fn(),
      render: vi.fn(),
    } as unknown as THREE.WebGLRenderer;
    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    const group = new THREE.Group();
    scene.add(group);
    const proj = new THREE.Matrix4().makeTranslation(0, 0, 0);
    const local = new THREE.Matrix4().makeTranslation(5, 0, 0);
    const items: Map3dRenderItem[] = [{ group, localMatrix: local, depthPass: 'opaque' }];
    renderMap3dSceneOnce(renderer, scene, camera, proj, items);
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(group.matrix.elements[12]).toBe(5);
  });

  it('renderMap3dSceneOnce keeps lights visible during render', () => {
    const scene = new THREE.Scene();
    const light = new THREE.AmbientLight(0xffffff, 1);
    scene.add(light);
    const group = new THREE.Group();
    scene.add(group);
    const camera = new THREE.Camera();
    const proj = new THREE.Matrix4();
    const items: Map3dRenderItem[] = [{ group, localMatrix: new THREE.Matrix4(), depthPass: 'opaque' }];
    let lightVisibleDuringRender = false;
    const renderer = {
      resetState: vi.fn(),
      clearDepth: vi.fn(),
      render: vi.fn(() => {
        lightVisibleDuringRender = light.visible;
      }),
    } as unknown as THREE.WebGLRenderer;
    renderMap3dSceneOnce(renderer, scene, camera, proj, items);
    expect(lightVisibleDuringRender).toBe(true);
  });

  it('renderMap3dSceneOnce can preserve depth for stacked custom layers', () => {
    const renderer = {
      resetState: vi.fn(),
      clearDepth: vi.fn(),
      render: vi.fn(),
    } as unknown as THREE.WebGLRenderer;
    const scene = new THREE.Scene();
    scene.add(new THREE.Group());
    const items: Map3dRenderItem[] = [
      { group: scene.children[0] as THREE.Group, localMatrix: new THREE.Matrix4(), depthPass: 'opaque' },
    ];
    renderMap3dSceneOnce(renderer, scene, new THREE.Camera(), new THREE.Matrix4(), items, {
      clearDepth: false,
    });
    expect(renderer.clearDepth).not.toHaveBeenCalled();
  });
});
