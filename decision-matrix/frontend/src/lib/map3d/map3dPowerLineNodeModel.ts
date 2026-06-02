export { powerLineNodeTowerMeshHeightM as powerLineNodeTowerRenderHeightM } from './map3dPowerLineTowerHeight';

export function shouldRenderPointAsPowerLineTower(subtype: string): boolean {
  return subtype === 'power_line_node';
}