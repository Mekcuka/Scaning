import type { InfraObject } from './api';
import type { PadEarthworkLast } from './api/padEarthworkApi';
import type { WellTrajectoryLastResponse } from './api/wellTrajectoryApi';
import { padParamsFromObject, readDemStatusFromProperties } from './infraPadEarthwork';
import { parseWellsLocalFromLast } from './padEarthworkSketch';
import {
  buildBottomholeSummaryRows,
  buildBottomholeSummaryTable,
  buildPadSummaryRows,
  buildPadsSummaryTable,
  type TransposedSummaryTable,
} from './padClusteringSummaryRows';
import { bottomholesLinkedToPad, orderBottomholesHierarchical } from './wellBottomholeProperties';

function parseElevation(raw: string): number {
  const t = raw.trim().replace(',', '.');
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

export function padSummaryKbM(pad: InfraObject, earthworkLast?: PadEarthworkLast | null): number {
  const params = earthworkLast?.params;
  const p = padParamsFromObject(pad);
  const heightM = params?.height_m ?? (parseElevation(p.heightM) || 1);
  const refM = params?.reference_elevation_m ?? parseElevation(p.referenceElevationM);
  return refM + heightM;
}

export function padSummaryWellsLocalCount(
  pad: InfraObject,
  earthworkLast?: PadEarthworkLast | null,
): number {
  return parseWellsLocalFromLast(
    earthworkLast?.wells_local ??
      (pad.properties as Record<string, unknown> | undefined)?.pad_wells_local_json,
  ).length;
}

export function padSummaryDemSource(
  pad: InfraObject,
  earthworkLast?: PadEarthworkLast | null,
): string | null {
  return (
    earthworkLast?.dem?.source ??
    readDemStatusFromProperties(pad.properties as Record<string, unknown> | undefined)?.source ??
    null
  );
}

/** Pad participates in project summary when it has bottomholes, uстья on sketch, or trajectories. */
export function padHasClusteringWells(
  pad: InfraObject,
  infraObjects: InfraObject[],
  earthworkLast?: PadEarthworkLast | null,
  trajectoryLast?: WellTrajectoryLastResponse | null,
): boolean {
  if (bottomholesLinkedToPad(infraObjects, pad.id).length > 0) return true;
  if (padSummaryWellsLocalCount(pad, earthworkLast) > 0) return true;
  if ((trajectoryLast?.trajectories?.length ?? 0) > 0) return true;
  return false;
}

export type PadClusteringProjectSummaryInput = {
  pads: InfraObject[];
  infraObjects: InfraObject[];
  earthworkByPadId: Map<string, PadEarthworkLast | null | undefined>;
  trajectoryByPadId: Map<string, WellTrajectoryLastResponse | null | undefined>;
};

export function buildProjectPadClusteringSummary(input: PadClusteringProjectSummaryInput): {
  padTable: TransposedSummaryTable;
  bottomholeTable: TransposedSummaryTable;
  padsWithWellsCount: number;
} {
  const nameById = new Map(input.infraObjects.map((obj) => [obj.id, obj.name]));
  const padsWithWells = input.pads.filter((pad) =>
    padHasClusteringWells(
      pad,
      input.infraObjects,
      input.earthworkByPadId.get(pad.id),
      input.trajectoryByPadId.get(pad.id),
    ),
  );

  const padEntries = padsWithWells.map((pad) => {
    const earthworkLast = input.earthworkByPadId.get(pad.id);
    const trajectoryLast = input.trajectoryByPadId.get(pad.id);
    const trajectories = trajectoryLast?.trajectories ?? [];
    return {
      padId: pad.id,
      rows: buildPadSummaryRows({
        pad,
        kbM: padSummaryKbM(pad, earthworkLast),
        wellsLocalCount: padSummaryWellsLocalCount(pad, earthworkLast),
        trajectoryComputedAt: trajectoryLast?.computed_at ?? null,
        demSource: padSummaryDemSource(pad, earthworkLast),
        trajectories,
      }),
    };
  });

  const bottomholeGroups: ReturnType<typeof buildBottomholeSummaryRows> = [];
  const bottomholeIds: string[] = [];
  const bottomholePadNames: string[] = [];

  for (const pad of padsWithWells) {
    const bottomholes = orderBottomholesHierarchical(
      bottomholesLinkedToPad(input.infraObjects, pad.id),
    );
    if (bottomholes.length === 0) continue;
    const trajectories = input.trajectoryByPadId.get(pad.id)?.trajectories ?? [];
    const groups = buildBottomholeSummaryRows(bottomholes, nameById, trajectories);
    for (let index = 0; index < groups.length; index++) {
      bottomholeGroups.push(groups[index]!);
      bottomholeIds.push(bottomholes[index]!.id);
      bottomholePadNames.push(pad.name);
    }
  }

  return {
    padTable: buildPadsSummaryTable(padEntries),
    bottomholeTable: buildBottomholeSummaryTable(bottomholeGroups, bottomholeIds, bottomholePadNames),
    padsWithWellsCount: padsWithWells.length,
  };
}
