import { describe, expect, it } from 'vitest';
import {
  powerLineNodeTowerRenderHeightM,
  shouldRenderPointAsPowerLineTower,
} from '../map3dPowerLineNodeModel';
import { powerLineInteriorTowerMeshHeightM } from '../map3dPowerLineTowerHeight';

describe('map3dPowerLineNodeModel', () => {
  it('identifies power_line_node subtype', () => {
    expect(shouldRenderPointAsPowerLineTower('power_line_node')).toBe(true);
    expect(shouldRenderPointAsPowerLineTower('node')).toBe(false);
    expect(shouldRenderPointAsPowerLineTower('methanol_joint')).toBe(false);
  });

  it('uses the same mesh height as ЛЭП interior supports', () => {
    expect(powerLineNodeTowerRenderHeightM(10, 1)).toBe(powerLineInteriorTowerMeshHeightM(10));
  });
});
