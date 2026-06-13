import { withDefaultInfraProperties } from './infraEntryDate';
import { withDefaultThroughputCapacity } from './infraCapacity';
import { withDefaultPadEarthworkDimensions } from './infraPadEarthwork';
import { withDefaultRender3DProperties } from './map3d/render3d';
import { isBottomholeSubtype } from './wellBottomholeProperties';
import { stripSandVolumeProperties } from './infraSandVolumes';

/** Defaults applied when creating/updating infra from the map (entry date, 3D, sand, throughput). */
export function mergeInfraPropertiesForSave(
  subtype: string,
  properties?: Record<string, unknown>,
): Record<string, unknown> {
  const merged = withDefaultInfraProperties(
    subtype,
    withDefaultPadEarthworkDimensions(
      subtype,
      withDefaultThroughputCapacity(
        subtype,
        withDefaultRender3DProperties(subtype, properties),
      ),
    ),
  );
  return isBottomholeSubtype(subtype) ? stripSandVolumeProperties(merged) : merged;
}
