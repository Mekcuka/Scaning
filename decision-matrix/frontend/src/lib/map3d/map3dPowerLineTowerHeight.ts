import { MAP3D_POWER_LINE_TOWER_SCALE, scaleMap3dMeters } from './map3dConfig';

/** glTF/procedural tower height (lines layer and power_line_node with linear-feature matrix). */
export function powerLineInteriorTowerMeshHeightM(towerHeightM: number): number {
  const nominalH = Math.max(8, towerHeightM);
  return scaleMap3dMeters(nominalH) * MAP3D_POWER_LINE_TOWER_SCALE;
}

/** Mesh height for `power_line_node` — same as interior supports on `power_line`. */
export function powerLineNodeTowerMeshHeightM(heightM: number, scale: number): number {
  return powerLineInteriorTowerMeshHeightM(heightM * scale);
}
