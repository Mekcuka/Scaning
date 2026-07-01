import { describe, expect, it } from 'vitest';
import {
  addBranchAtPath,
  emptyTreeNode,
  flattenTree,
  mergePyWellGeoTreeRecords,
  pyWellGeoDraftEquals,
  pyWellGeoDraftFromSources,
  setNodeAtPath,
  upsertTree,
} from '../../../lib/padClusteringPyWellGeoSettings';

describe('padClusteringPyWellGeoSettings', () => {
  it('draft from empty properties uses defaults', () => {
    const draft = pyWellGeoDraftFromSources(null);
    expect(draft.settings.default_radius_m).toBeCloseTo(0.10795);
    expect(draft.trees).toEqual([]);
  });

  it('upsertTree replaces same well_index', () => {
    const node = emptyTreeNode();
    const a = { well_index: 0, tree: node };
    const b = { well_index: 0, tree: { ...node, name: 'updated' } };
    expect(upsertTree([a], b)[0]?.tree.name).toBe('updated');
  });

  it('tree editor helpers mutate nested branches', () => {
    let root = emptyTreeNode();
    root = addBranchAtPath(root, [], { ...emptyTreeNode('b1'), x: 5 });
    expect(flattenTree(root).length).toBe(2);
    root = setNodeAtPath(root, [0], { x: 99 });
    expect(root.branches[0]?.x).toBe(99);
  });

  it('pyWellGeoDraftFromSources prefers richer trees from properties', () => {
    const shallow = {
      well_index: 0,
      tree: emptyTreeNode(),
    };
    const withLateral = {
      well_index: 0,
      tree: {
        ...emptyTreeNode(),
        branches: [{ ...emptyTreeNode('lat1'), x: 10, branches: [] }],
      },
    };
    const draft = pyWellGeoDraftFromSources(
      { pad_pywellgeo_trees_json: [withLateral] },
      { trees: [shallow] },
    );
    expect(draft.trees[0]?.tree.branches.length).toBe(1);
  });
});
