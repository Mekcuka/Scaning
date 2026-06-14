import { useMemo } from 'react';
import type { InfraObject } from '../../lib/api';
import { InfraPointSnapIndex } from '../../lib/infraSnapIndex';
import type { MapViewRefs } from './mapViewRefs';

export function useMapViewSnapIndex(
  refs: MapViewRefs,
  infraSnapPool: InfraObject[] | undefined,
  infraObjects: InfraObject[],
): void {
  const { snapIndexRef } = refs;
  const pool = infraSnapPool ?? infraObjects;
  const snapIndex = useMemo(() => new InfraPointSnapIndex(pool), [pool]);
  snapIndexRef.current = snapIndex;
}