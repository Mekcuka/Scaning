import { api, type InfraObject } from './api';
import { isLineSubtype } from './infraGeometry';
import { mergeInfraPropertiesForSave } from './mergeInfraPropertiesForSave';
import {
  buildLineSplitPlan,
  findLineSplitAtPoint,
  type LineSplitCandidate,
} from './lineSplit';

export type LineSplitHint = {
  lineId: string;
  segmentIndex: number;
  snapLon?: number;
  snapLat?: number;
};

/** Map hit or geometry search for splitting an existing line at a point. */
export function resolveLineSplitCandidate(
  lon: number,
  lat: number,
  pool: InfraObject[],
  splitHint?: LineSplitHint,
): LineSplitCandidate | null {
  const splitFromMap =
    splitHint?.lineId != null
      ? (() => {
          const line = pool.find((o) => o.id === splitHint.lineId);
          if (!line || !isLineSubtype(line.subtype)) return null;
          return {
            line,
            segmentIndex: splitHint.segmentIndex,
            snapLon: splitHint.snapLon ?? lon,
            snapLat: splitHint.snapLat ?? lat,
            distanceKm: 0,
          };
        })()
      : null;
  return splitFromMap ?? findLineSplitAtPoint([lon, lat], pool);
}

export async function applyInfraLineSplit(params: {
  projectId: string;
  split: LineSplitCandidate;
  splitLon: number;
  splitLat: number;
}): Promise<{ updated: InfraObject; second: InfraObject } | null> {
  const { projectId, split, splitLon, splitLat } = params;
  const secondName = `${split.line.name} (2)`;
  const plan = buildLineSplitPlan(
    split.line,
    split.segmentIndex,
    splitLon,
    splitLat,
    secondName,
  );
  if (!plan) return null;

  const updated = await api.updateInfraObject(projectId, split.line.id, plan.firstPayload);
  const second = await api.createInfraObject(projectId, {
    ...plan.secondPayload,
    properties: mergeInfraPropertiesForSave(
      plan.secondPayload.subtype,
      plan.secondPayload.properties,
    ),
  });
  try {
    await api.buildNetwork(projectId);
  } catch {
    /* best-effort */
  }
  return { updated, second };
}
