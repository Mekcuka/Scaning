import { withDefaultInfraProperties } from './infraEntryDate';
import { withDefaultThroughputCapacity } from './infraCapacity';
import { withDefaultRender3DProperties } from './map3d/render3d';

/** Defaults applied when creating/updating infra from the map (entry date, 3D, sand, throughput). */
export function mergeInfraPropertiesForSave(
  subtype: string,
  properties?: Record<string, unknown>,
): Record<string, unknown> {
  return withDefaultInfraProperties(
    subtype,
    withDefaultThroughputCapacity(
      subtype,
      withDefaultRender3DProperties(subtype, properties),
    ),
  );
}
