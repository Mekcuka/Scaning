import { describe, expect, it, vi } from 'vitest';

import { buildToolbarSection } from '../buildToolbarSection';

describe('buildToolbarSection', () => {
  it('wires line elevation profile compute from map actions', () => {
    const computeLineProfile = vi.fn();
    const toolbar = buildToolbarSection({
      projectId: 'proj-1',
      canWriteProject: true,
      canWriteInfra: true,
      canEditMap: true,
      map3dFeatureEnabled: true,
      mapDisplayMode: '2d',
      mapIn3d: false,
      shell: {
        mapLayersOpen: false,
        setMapLayersOpen: vi.fn(),
        mapFullscreen: false,
        toggleMapFullscreen: vi.fn(),
      } as never,
      edit: {
        selectedPoiId: null,
        mapEditEnabled: true,
        setMapEditEnabled: vi.fn(),
        drawMode: 'select',
        setDrawMode: vi.fn(),
        selectMode: 'single',
        setSelectMode: vi.fn(),
        searchQ: '',
        setSearchQ: vi.fn(),
        searchOpen: false,
        setSearchOpen: vi.fn(),
        pointMenuOpen: false,
        setPointMenuOpen: vi.fn(),
        lineMenuOpen: false,
        setLineMenuOpen: vi.fn(),
        bottomholeMenuOpen: false,
        setBottomholeMenuOpen: vi.fn(),
        infraForm: { subtype: 'autoroad' },
        setInfraForm: vi.fn(),
        setSelectedPoiId: vi.fn(),
      } as never,
      data: {
        pois: [{ id: 'poi-1', name: 'POI', lon: 0, lat: 0 }],
        selectedPoi: null,
        canUndo: false,
        performUndo: vi.fn(),
        projectJobBusy: false,
        searchSuggestions: [],
        pickSearchResult: vi.fn(),
      } as never,
      actions: {
        switchMapDisplayMode: vi.fn(),
        resetDrawingMenusForToolbar: vi.fn(),
        canCopyMapSelection: false,
        copyMapSelection: vi.fn(),
        canPasteMapClipboard: false,
        enterPasteMode: vi.fn(),
        canCutMapSelection: false,
        cutMapSelection: vi.fn(),
        canDeleteCurrentSelection: false,
        selectedOnMapCount: 0,
        deleteGroupMut: { isPending: false },
        deleteInfraMut: { isPending: false },
        requestDeleteSelection: vi.fn(),
        clearLineDraft: vi.fn(),
        clearRulerState: vi.fn(),
        analyzePending: false,
        analyzeAllMut: { mutate: vi.fn() },
        analyzeSelectedMut: { mutate: vi.fn() },
        computeLineProfile,
        lineProfileComputePending: true,
      } as never,
    });

    expect(toolbar.onLineProfileCompute).toBe(computeLineProfile);
    expect(toolbar.lineProfileComputePending).toBe(true);

    toolbar.onLineProfileCompute?.();
    expect(computeLineProfile).toHaveBeenCalledTimes(1);
  });
});
