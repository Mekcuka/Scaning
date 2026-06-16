import type { AppSelectOption } from '../components/AppSelect';
import type { InfraObject } from './api';
import { lonLatToLocalEnu } from './padClusteringScene3d';
import type { PyWellGeoTreeNode } from './api/pywellgeoApi';
import {
  assignBottomholeWellIndices,
  bottomholesExternalToPad,
  bottomholesLinkedToPad,
  readBottomholeLinkedPadId,
  readBottomholeTvdM,
  readGsHeelTvdM,
  readGsLineEndpoints,
  readGsToeTvdM,
  readStoredBottomholeWellIndex,
  isGsBottomholeLine,
  isLateralBottomhole,
  GS_HEEL_LABEL,
  GS_TOE_LABEL,
} from './wellBottomholeProperties';
import type { TreeNodePath } from './padClusteringPyWellGeoSettings';
import {
  flattenTree,
  getNodeAtPath,
  isMainBoreContinuation,
  isMainBorePath,
  isOnLateralBranch,
  lateralEntryPath,
} from './padClusteringPyWellGeoSettings';

export type LateralMode = 'azim_dip' | 'xyz' | 'bottomhole';

export type BottomholeTargetSource = 'pad' | 'project';

export type BottomholeTarget = {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  wellIndex: number | null;
  source: BottomholeTargetSource;
  linkedPadId?: string | null;
  isLateral?: boolean;
};

const PAD_WELL_TARGET_GROUP = 'Забои этой скважины';
const PAD_OTHER_TARGET_GROUP = 'Другие забои куста';
const PROJECT_TARGET_GROUP = 'Другие забои проекта';
const LATERAL_WELL_TARGET_GROUP = 'Доп.стволы этой скважины';
const LATERAL_OTHER_PAD_GROUP = 'Доп.стволы других скважин куста';
const LATERAL_EXTERNAL_GROUP = 'Доп.стволы других кустов';

function pushPointTarget(
  out: BottomholeTarget[],
  id: string,
  label: string,
  east: number,
  north: number,
  tvd: number,
  wellIndex: number | null,
  source: BottomholeTargetSource,
  linkedPadId?: string | null,
  isLateral = false,
): void {
  out.push({
    id,
    label,
    x: east,
    y: north,
    z: -tvd,
    wellIndex,
    source,
    linkedPadId,
    isLateral,
  });
}

function collectBottomholeTargetsFromList(
  bottomholes: InfraObject[],
  padLon: number,
  padLat: number,
  source: BottomholeTargetSource,
  options?: { useAutoWellIndex?: boolean },
): BottomholeTarget[] {
  const useAutoWellIndex = options?.useAutoWellIndex ?? source === 'pad';
  const indexMap = useAutoWellIndex ? assignBottomholeWellIndices(bottomholes) : new Map<string, number>();
  const out: BottomholeTarget[] = [];

  for (const bh of bottomholes) {
    const storedIdx = readStoredBottomholeWellIndex(bh.properties);
    const idx = useAutoWellIndex ? (indexMap.get(bh.id) ?? null) : storedIdx;
    if (useAutoWellIndex && idx == null) continue;

    const props = bh.properties ?? {};
    const subtype = (bh.subtype ?? '').toLowerCase();
    const linkedPadId = readBottomholeLinkedPadId(props);
    const lateral = isLateralBottomhole(bh);

    if (isGsBottomholeLine(bh)) {
      const endpoints = readGsLineEndpoints(bh);
      if (!endpoints) continue;
      const heelTvd = readGsHeelTvdM(props);
      const toeTvd = readGsToeTvdM(props);
      for (const [label, lon, lat, tvd] of [
        [GS_HEEL_LABEL, endpoints.heelLon, endpoints.heelLat, heelTvd] as const,
        [GS_TOE_LABEL, endpoints.toeLon, endpoints.toeLat, toeTvd] as const,
      ]) {
        const local = lonLatToLocalEnu(lon, lat, padLon, padLat);
        pushPointTarget(
          out,
          `${bh.id}:${label === GS_HEEL_LABEL ? 'heel' : 'toe'}`,
          `${bh.name} (${label})`,
          local.east_m,
          local.north_m,
          tvd,
          idx,
          source,
          linkedPadId,
          lateral,
        );
      }
      continue;
    }

    const local = lonLatToLocalEnu(bh.lon, bh.lat, padLon, padLat);
    const tvd =
      subtype === 'well_bottomhole_gs_toe'
        ? readGsToeTvdM(props)
        : subtype === 'well_bottomhole_gs_heel'
          ? readGsHeelTvdM(props)
          : readBottomholeTvdM(props);
    const suffix =
      subtype === 'well_bottomhole_gs_toe'
        ? ` (${GS_TOE_LABEL})`
        : subtype === 'well_bottomhole_gs_heel'
          ? ` (${GS_HEEL_LABEL})`
          : lateral
            ? ' (доп.)'
            : '';
    pushPointTarget(
      out,
      bh.id,
      `${bh.name}${suffix}`,
      local.east_m,
      local.north_m,
      tvd,
      idx,
      source,
      linkedPadId,
      lateral,
    );
  }

  out.sort((a, b) => a.label.localeCompare(b.label, 'ru'));
  return out;
}

/** Pad-linked bottomhole targets (any well slot on this pad). */
export function bottomholeTargetsForPad(
  bottomholes: InfraObject[],
  padLon: number,
  padLat: number,
): BottomholeTarget[] {
  return collectBottomholeTargetsFromList(bottomholes, padLon, padLat, 'pad');
}

/** External project bottomholes (not linked to this pad). */
export function bottomholeTargetsExternal(
  infraObjects: InfraObject[],
  padId: string,
  padLon: number,
  padLat: number,
): BottomholeTarget[] {
  const external = bottomholesExternalToPad(infraObjects, padId);
  return collectBottomholeTargetsFromList(external, padLon, padLat, 'project', {
    useAutoWellIndex: false,
  });
}

/** All kick-off targets on the pad (any well slot). */
export function bottomholeTargetsAll(
  bottomholes: InfraObject[],
  padLon: number,
  padLat: number,
): BottomholeTarget[] {
  return bottomholeTargetsForPad(bottomholes, padLon, padLat);
}

export function bottomholeTargetsForWell(
  bottomholes: InfraObject[],
  wellIndex: number,
  padLon: number,
  padLat: number,
): BottomholeTarget[] {
  return bottomholeTargetsForPad(bottomholes, padLon, padLat).filter((t) => t.wellIndex === wellIndex);
}

export function buildBottomholeTargetCatalog(
  infraObjects: InfraObject[],
  padId: string,
  padLon: number,
  padLat: number,
): { padTargets: BottomholeTarget[]; externalTargets: BottomholeTarget[]; allTargets: BottomholeTarget[] } {
  const padBottomholes = bottomholesLinkedToPad(infraObjects, padId);
  const padTargets = bottomholeTargetsForPad(padBottomholes, padLon, padLat);
  const externalTargets = bottomholeTargetsExternal(infraObjects, padId, padLon, padLat);
  return {
    padTargets,
    externalTargets,
    allTargets: [...padTargets, ...externalTargets],
  };
}

export function formatBottomholeTargetOptionLabel(
  target: BottomholeTarget,
  selectedWellIndex: number,
): string {
  if (target.source === 'project') {
    if (target.linkedPadId) return `${target.label} · другой куст`;
    return `${target.label} · без куста`;
  }
  if (target.wellIndex == null) return target.label;
  const slot = `Скв-${target.wellIndex + 1}`;
  if (target.wellIndex === selectedWellIndex) return `${target.label} · ${slot}`;
  return `${target.label} · ${slot} (design)`;
}

export function isBottomholeTargetSelectable(
  _target: BottomholeTarget,
  _selectedWellIndex: number,
): boolean {
  return true;
}

/** Marker color hint for 3D preview: same slot / other pad slot / external project. */
export function bottomholeTargetMarkerColor(
  target: BottomholeTarget,
  selectedWellIndex: number,
): 'blue' | 'amber' | 'red' {
  if (target.source === 'project') return 'red';
  if (target.wellIndex === selectedWellIndex) return 'blue';
  return 'amber';
}

export function findBottomholeTargetById(
  targets: BottomholeTarget[],
  id: string,
): BottomholeTarget | undefined {
  return targets.find((t) => t.id === id);
}

function groupHeaderOption(group: string): AppSelectOption {
  return { value: `__group:${group}`, label: group, disabled: true };
}

export function buildBottomholeSelectOptions(
  padTargets: BottomholeTarget[],
  externalTargets: BottomholeTarget[],
  selectedWellIndex: number,
): AppSelectOption[] {
  const options: AppSelectOption[] = [];
  const lateralsThisWell = padTargets.filter(
    (t) => t.isLateral && t.wellIndex === selectedWellIndex,
  );
  const lateralsOtherPad = padTargets.filter(
    (t) => t.isLateral && t.wellIndex !== selectedWellIndex,
  );
  const lateralsExternal = externalTargets.filter((t) => t.isLateral);
  const mainsThisWell = padTargets.filter(
    (t) => !t.isLateral && t.wellIndex === selectedWellIndex,
  );
  const mainsOtherPad = padTargets.filter(
    (t) => !t.isLateral && t.wellIndex !== selectedWellIndex,
  );
  const mainsExternal = externalTargets.filter((t) => !t.isLateral);

  if (lateralsThisWell.length > 0) {
    options.push(groupHeaderOption(LATERAL_WELL_TARGET_GROUP));
    for (const target of lateralsThisWell) {
      options.push({
        value: target.id,
        label: formatBottomholeTargetOptionLabel(target, selectedWellIndex),
      });
    }
  }

  if (lateralsOtherPad.length > 0) {
    options.push(groupHeaderOption(LATERAL_OTHER_PAD_GROUP));
    for (const target of lateralsOtherPad) {
      options.push({
        value: target.id,
        label: formatBottomholeTargetOptionLabel(target, selectedWellIndex),
      });
    }
  }

  if (lateralsExternal.length > 0) {
    options.push(groupHeaderOption(LATERAL_EXTERNAL_GROUP));
    for (const target of lateralsExternal) {
      options.push({
        value: target.id,
        label: formatBottomholeTargetOptionLabel(target, selectedWellIndex),
      });
    }
  }

  if (mainsThisWell.length > 0) {
    options.push(groupHeaderOption(PAD_WELL_TARGET_GROUP));
    for (const target of mainsThisWell) {
      options.push({
        value: target.id,
        label: formatBottomholeTargetOptionLabel(target, selectedWellIndex),
      });
    }
  }

  if (mainsOtherPad.length > 0) {
    options.push(groupHeaderOption(PAD_OTHER_TARGET_GROUP));
    for (const target of mainsOtherPad) {
      options.push({
        value: target.id,
        label: formatBottomholeTargetOptionLabel(target, selectedWellIndex),
      });
    }
  }

  if (mainsExternal.length > 0) {
    options.push(groupHeaderOption(PROJECT_TARGET_GROUP));
    for (const target of mainsExternal) {
      options.push({
        value: target.id,
        label: formatBottomholeTargetOptionLabel(target, selectedWellIndex),
      });
    }
  }

  return options;
}

/** Lateral bottomhole targets for the selected well slot (PyWellGeo «До забоя»). */
export function lateralBottomholeTargetsForWell(
  bottomholes: InfraObject[],
  wellIndex: number,
  padLon: number,
  padLat: number,
): BottomholeTarget[] {
  return bottomholeTargetsForPad(bottomholes, padLon, padLat).filter(
    (t) => t.isLateral && t.wellIndex === wellIndex,
  );
}

/** Build lateral polyline from kick-off using azimuth/dip/length (PyWellGeo z = -TVD). */
export function lateralXyzFromAzimDip(
  kickoff: { x: number; y: number; z: number },
  azimDeg: number,
  dipDeg: number,
  lengthM: number,
  steps = 5,
): number[][] {
  const az = (azimDeg * Math.PI) / 180;
  const dip = (dipDeg * Math.PI) / 180;
  const dx = Math.sin(az) * Math.cos(dip);
  const dy = Math.cos(az) * Math.cos(dip);
  const dz = -Math.sin(dip);
  const points: number[][] = [[kickoff.x, kickoff.y, kickoff.z]];
  for (let i = 1; i <= steps; i += 1) {
    const t = (lengthM * i) / steps;
    points.push([kickoff.x + dx * t, kickoff.y + dy * t, kickoff.z + dz * t]);
  }
  return points;
}

export function parseXyzLines(text: string): number[][] {
  return text
    .trim()
    .split('\n')
    .map((line) => line.split(/[,;\s]+/).map((v) => Number(v.trim())))
    .filter((p) => p.length === 3 && p.every((n) => Number.isFinite(n)));
}

export function lateralXyzToBottomhole(
  kickoff: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
): number[][] {
  return [
    [kickoff.x, kickoff.y, kickoff.z],
    [target.x, target.y, target.z],
  ];
}

export type TreeListFilter = 'all' | 'branches_only' | 'main_and_kickoffs';

export function filterTreeNodes(
  nodes: Array<{ path: TreeNodePath; node: PyWellGeoTreeNode }>,
  filter: TreeListFilter,
  root?: PyWellGeoTreeNode,
): Array<{ path: TreeNodePath; node: PyWellGeoTreeNode }> {
  if (filter === 'all') return nodes;
  if (!root) {
    if (filter === 'branches_only') return nodes.filter(({ path }) => path.length > 0);
    return nodes;
  }
  if (filter === 'branches_only') {
    return nodes.filter(({ path }) => !isMainBorePath(root, path));
  }
  return nodes.filter(
    ({ path }) => isMainBorePath(root, path) || isOnLateralBranch(root, path),
  );
}

export type TreeGroup = {
  id: string;
  title: string;
  nodes: Array<{ path: TreeNodePath; node: PyWellGeoTreeNode }>;
};

export function groupTreeNodes(
  nodes: Array<{ path: TreeNodePath; node: PyWellGeoTreeNode }>,
  root?: PyWellGeoTreeNode,
): TreeGroup[] {
  const main: TreeGroup = { id: 'main', title: 'Ствол', nodes: [] };
  const groups = new Map<string, TreeGroup>();

  for (const item of nodes) {
    if (!root || isMainBorePath(root, item.path)) {
      main.nodes.push(item);
      continue;
    }
    const entry = lateralEntryPath(root, item.path);
    const id = entry ? `branch-${entry.join('.')}` : `branch-${item.path[0]}`;
    if (!groups.has(id)) {
      const entryNode = entry && root ? getNodeAtPath(root, entry) : item.node;
      const label = entryNode?.name && entryNode.name !== 'main' ? entryNode.name : `Боковой ${groups.size + 1}`;
      groups.set(id, { id, title: `Боковой ствол · ${label}`, nodes: [] });
    }
    groups.get(id)!.nodes.push(item);
  }
  return [main, ...Array.from(groups.values())];
}

export function countLateralBranches(tree: PyWellGeoTreeNode): number {
  let count = 0;
  const visit = (node: PyWellGeoTreeNode) => {
    for (let idx = 0; idx < node.branches.length; idx += 1) {
      const branch = node.branches[idx]!;
      if (!isMainBoreContinuation(node, branch, idx)) count += 1;
      visit(branch);
    }
  };
  visit(tree);
  return count;
}
