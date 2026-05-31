import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildTransmissionTowerMesh,
  createPowerLineGroup,
} from './map3dPowerLineMeshes';

const wireEp = (lon: number, lat: number, altM: number) => ({ lon, lat, altM });

function countTowerGroups(root: THREE.Group): number {
  return root.children.filter(
    (c) => c instanceof THREE.Group && c.children.length > 3,
  ).length;
}

describe('map3dPowerLineMeshes', () => {
  it('builds a tower mesh with children', () => {
    const color = new THREE.Color('#cc0000');
    const tower = buildTransmissionTowerMesh(50, color, false);
    expect(tower.children.length).toBeGreaterThan(3);
  });

  it('draws tower only on interior vertices', () => {
    const built = createPowerLineGroup({
      path: [
        [37.6, 55.7],
        [37.61, 55.71],
        [37.62, 55.72],
      ],
      alts: [100, 100, 100],
      startWire: wireEp(37.6, 55.7, 100),
      finishWire: wireEp(37.62, 55.72, 100),
      colorHex: '#ff0000',
      opacity: 1,
      towerHeightM: 10,
      selected: false,
      towerMode: 'procedural',
    });
    expect(built).not.toBeNull();
    expect(countTowerGroups(built!.group)).toBe(1);
  });

  it('draws no towers on two-vertex line', () => {
    const built = createPowerLineGroup({
      path: [
        [37.6, 55.7],
        [37.61, 55.71],
      ],
      alts: [100, 100],
      startWire: wireEp(37.6, 55.7, 100),
      finishWire: wireEp(37.61, 55.71, 100),
      colorHex: '#ff0000',
      opacity: 1,
      towerHeightM: 10,
      selected: false,
      towerMode: 'procedural',
    });
    expect(built).not.toBeNull();
    expect(countTowerGroups(built!.group)).toBe(0);
    expect(built!.group.children.length).toBe(3);
  });

  it('returns null for single vertex', () => {
    expect(
      createPowerLineGroup({
        path: [[37.6, 55.7]],
        alts: [100],
        startWire: wireEp(37.6, 55.7, 100),
        finishWire: wireEp(37.6, 55.7, 100),
        colorHex: '#ff0000',
        opacity: 1,
        towerHeightM: 10,
        selected: false,
      }),
    ).toBeNull();
  });
});
