import type { PyWellGeoSettings, PyWellGeoTreeNode, PyWellGeoTreeRecord } from './api/pywellgeoApi';
import { DEFAULT_PYWELLGEO_SETTINGS } from './api/pywellgeoApi';

export const PAD_PYWELLGEO_SETTINGS_JSON = 'pad_pywellgeo_settings_json';
export const PAD_PYWELLGEO_TREES_JSON = 'pad_pywellgeo_trees_json';
export const PAD_PYWELLGEO_LAST_COMPUTED_AT = 'pad_pywellgeo_last_computed_at';

export type PadClusteringPyWellGeoDraft = {
  settings: PyWellGeoSettings;
  trees: PyWellGeoTreeRecord[];
};

export function settingsFromProperties(props: Record<string, unknown> | null | undefined): PyWellGeoSettings {
  const raw = props?.[PAD_PYWELLGEO_SETTINGS_JSON];
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PYWELLGEO_SETTINGS };
  return { ...DEFAULT_PYWELLGEO_SETTINGS, ...(raw as PyWellGeoSettings) };
}

export function treesFromProperties(props: Record<string, unknown> | null | undefined): PyWellGeoTreeRecord[] {
  const raw = props?.[PAD_PYWELLGEO_TREES_JSON];
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is PyWellGeoTreeRecord => typeof item === 'object' && item !== null);
}

/** Prefer the richer tree per well_index when merging properties and /pywellgeo/last. */
export function mergePyWellGeoTreeRecords(
  a: PyWellGeoTreeRecord[],
  b: PyWellGeoTreeRecord[],
): PyWellGeoTreeRecord[] {
  const map = new Map<number, PyWellGeoTreeRecord>();
  for (const record of [...a, ...b]) {
    const prev = map.get(record.well_index);
    if (!prev || countTreeNodes(record.tree) >= countTreeNodes(prev.tree)) {
      map.set(record.well_index, record);
    }
  }
  return [...map.values()].sort((x, y) => x.well_index - y.well_index);
}

export function pyWellGeoDraftFromSources(
  properties: Record<string, unknown> | null | undefined,
  last?: { settings?: PyWellGeoSettings; trees?: PyWellGeoTreeRecord[] } | null,
): PadClusteringPyWellGeoDraft {
  const fromProps = treesFromProperties(properties);
  const fromLast = last?.trees ?? [];
  return {
    settings: last?.settings ?? settingsFromProperties(properties),
    trees: mergePyWellGeoTreeRecords(fromProps, fromLast),
  };
}

export function mergePyWellGeoIntoProperties(
  existing: Record<string, unknown>,
  draft: PadClusteringPyWellGeoDraft,
): Record<string, unknown> {
  return {
    ...existing,
    [PAD_PYWELLGEO_SETTINGS_JSON]: draft.settings,
    [PAD_PYWELLGEO_TREES_JSON]: draft.trees,
  };
}

export function pyWellGeoDraftEquals(a: PadClusteringPyWellGeoDraft, b: PadClusteringPyWellGeoDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function treeForWellIndex(trees: PyWellGeoTreeRecord[], wellIndex: number): PyWellGeoTreeRecord | null {
  return trees.find((t) => t.well_index === wellIndex) ?? null;
}

export function upsertTree(trees: PyWellGeoTreeRecord[], record: PyWellGeoTreeRecord): PyWellGeoTreeRecord[] {
  const next = trees.filter((t) => t.well_index !== record.well_index);
  next.push(record);
  next.sort((a, b) => a.well_index - b.well_index);
  return next;
}

export function emptyTreeNode(name = 'main'): PyWellGeoTreeNode {
  return {
    x: 0,
    y: 0,
    z: 0,
    radius: 0.10795,
    perforated: false,
    color: 'black',
    name,
    branches: [],
  };
}

export function countTreeNodes(node: PyWellGeoTreeNode): number {
  return 1 + node.branches.reduce((sum, b) => sum + countTreeNodes(b), 0);
}

/** Flat list of nodes with path indices for editor selection. */
export type TreeNodePath = number[];

export function flattenTree(node: PyWellGeoTreeNode, path: TreeNodePath = []): Array<{ path: TreeNodePath; node: PyWellGeoTreeNode }> {
  const out: Array<{ path: TreeNodePath; node: PyWellGeoTreeNode }> = [{ path, node }];
  node.branches.forEach((branch, i) => {
    out.push(...flattenTree(branch, [...path, i]));
  });
  return out;
}

export function getNodeAtPath(root: PyWellGeoTreeNode, path: TreeNodePath): PyWellGeoTreeNode | null {
  let current = root;
  for (const idx of path) {
    if (!current.branches[idx]) return null;
    current = current.branches[idx]!;
  }
  return current;
}

export function setNodeAtPath(root: PyWellGeoTreeNode, path: TreeNodePath, patch: Partial<PyWellGeoTreeNode>): PyWellGeoTreeNode {
  if (path.length === 0) {
    return { ...root, ...patch, branches: patch.branches ?? root.branches };
  }
  const [head, ...rest] = path;
  const branches = root.branches.map((b, i) =>
    i === head ? setNodeAtPath(b, rest, patch) : b,
  );
  return { ...root, branches };
}

export function addBranchAtPath(root: PyWellGeoTreeNode, path: TreeNodePath, branch: PyWellGeoTreeNode): PyWellGeoTreeNode {
  const parent = getNodeAtPath(root, path);
  if (!parent) return root;
  const newBranch = { ...branch, name: branch.name || `branch${parent.branches.length + 1}` };
  return setNodeAtPath(root, path, { branches: [...parent.branches, newBranch] });
}

export function removeBranchAtPath(root: PyWellGeoTreeNode, path: TreeNodePath): PyWellGeoTreeNode {
  if (path.length === 0) return root;
  if (path.length === 1) {
    const idx = path[0]!;
    return { ...root, branches: root.branches.filter((_, i) => i !== idx) };
  }
  const [head, ...rest] = path;
  const branches = root.branches.map((b, i) => (i === head ? removeBranchAtPath(b, rest) : b));
  return { ...root, branches };
}

export function wellLabel(index: number, name?: string | null): string {
  if (name?.trim()) return name.trim();
  return `Скв-${index + 1}`;
}

/** PyWellGeo main bore continues via branches[0] while child name is main (or matches parent). */
export function isMainBoreContinuation(
  parent: PyWellGeoTreeNode,
  child: PyWellGeoTreeNode,
  branchIndex: number,
): boolean {
  if (branchIndex !== 0) return false;
  return child.name === 'main' || child.name === parent.name;
}

export function isMainBorePath(root: PyWellGeoTreeNode, path: TreeNodePath): boolean {
  if (path.length === 0) return true;
  let node = root;
  for (const idx of path) {
    const child = node.branches[idx];
    if (!child || !isMainBoreContinuation(node, child, idx)) return false;
    node = child;
  }
  return true;
}

/** Path to the node where a lateral branch splits from the main bore (or null for main-bore nodes). */
export function lateralEntryPath(root: PyWellGeoTreeNode, path: TreeNodePath): TreeNodePath | null {
  if (path.length === 0 || isMainBorePath(root, path)) return null;
  let node = root;
  const prefix: TreeNodePath = [];
  for (const idx of path) {
    prefix.push(idx);
    const child = node.branches[idx];
    if (!child) return prefix;
    if (!isMainBoreContinuation(node, child, idx)) return prefix;
    node = child;
  }
  return null;
}

export function isLateralKickoff(root: PyWellGeoTreeNode, path: TreeNodePath): boolean {
  const entry = lateralEntryPath(root, path);
  return entry !== null && entry.length === path.length && entry.every((v, i) => v === path[i]);
}

/** Any node on a lateral branch (kick-off and stations chained via branches[0]). */
export function isOnLateralBranch(root: PyWellGeoTreeNode, path: TreeNodePath): boolean {
  return path.length > 0 && lateralEntryPath(root, path) !== null;
}
