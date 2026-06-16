import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBottomholeDraw } from './useBottomholeDraw';

describe('useBottomholeDraw', () => {
  it('creates NNB on single click', async () => {
    const placeBottomholeAt = vi.fn().mockResolvedValue({ id: 'bh-1', name: 'BH-1' });
    const placeGsBottomholeAt = vi.fn();
    const pushToast = vi.fn();
    const { result } = renderHook(() =>
      useBottomholeDraw({
        projectId: 'p1',
        drawMode: 'bottomhole_nnb',
        infraObjects: [
          {
            id: 'pad-1',
            subtype: 'oil_pad',
            lon: 37.62,
            lat: 55.76,
          } as never,
        ],
        canWriteInfra: true,
        nextAutoName: () => 'BH-1',
        placeBottomholeAt,
        placeGsBottomholeAt,
        pushToast,
      }),
    );

    await act(async () => {
      await result.current.handleMapClickForBottomholeDraw(37.621, 55.761);
    });

    expect(placeBottomholeAt).toHaveBeenCalledWith(
      'well_bottomhole_nnb',
      37.621,
      55.761,
      expect.objectContaining({ well_bottomhole_linked_pad_id: 'pad-1' }),
    );
  });

  it('requires two clicks for GS (heel draft then single line create)', async () => {
    const placeBottomholeAt = vi.fn();
    const placeGsBottomholeAt = vi.fn().mockResolvedValue({ id: 'gs-1', name: 'GS-1' });
    const pushToast = vi.fn();
    const { result } = renderHook(() =>
      useBottomholeDraw({
        projectId: 'p1',
        drawMode: 'bottomhole_gs',
        infraObjects: [
          {
            id: 'pad-1',
            subtype: 'oil_pad',
            lon: 37.62,
            lat: 55.76,
          } as never,
        ],
        canWriteInfra: true,
        nextAutoName: (st) => st,
        placeBottomholeAt,
        placeGsBottomholeAt,
        pushToast,
      }),
    );

    await act(async () => {
      await result.current.handleMapClickForBottomholeDraw(37.621, 55.761);
    });
    expect(placeGsBottomholeAt).not.toHaveBeenCalled();
    expect(result.current.gsHeelDraft).toEqual({
      lon: 37.621,
      lat: 55.761,
      linkedPadId: 'pad-1',
      parentId: null,
      isLateral: false,
    });

    await act(async () => {
      await result.current.handleMapClickForBottomholeDraw(37.622, 55.761);
    });
    expect(placeGsBottomholeAt).toHaveBeenCalledWith(
      37.621,
      55.761,
      37.622,
      55.761,
      expect.objectContaining({ well_bottomhole_linked_pad_id: 'pad-1' }),
    );
    expect(result.current.gsHeelDraft).toBeNull();
  });

  it('creates NNB without pad when none on map', async () => {
    const placeBottomholeAt = vi.fn().mockResolvedValue({ id: 'bh-1', name: 'BH-1' });
    const placeGsBottomholeAt = vi.fn();
    const pushToast = vi.fn();
    const { result } = renderHook(() =>
      useBottomholeDraw({
        projectId: 'p1',
        drawMode: 'bottomhole_nnb',
        infraObjects: [],
        canWriteInfra: true,
        nextAutoName: () => 'BH-1',
        placeBottomholeAt,
        placeGsBottomholeAt,
        pushToast,
      }),
    );

    await act(async () => {
      await result.current.handleMapClickForBottomholeDraw(37.621, 55.761);
    });

    expect(placeBottomholeAt).toHaveBeenCalledWith(
      'well_bottomhole_nnb',
      37.621,
      55.761,
      expect.not.objectContaining({ well_bottomhole_linked_pad_id: expect.anything() }),
    );
    expect(pushToast).not.toHaveBeenCalledWith('error', expect.any(String));
  });

  it('creates lateral NNB linked to nearest main bottomhole', async () => {
    const placeBottomholeAt = vi.fn().mockResolvedValue({ id: 'lat-1', name: 'Lat-1' });
    const placeGsBottomholeAt = vi.fn();
    const pushToast = vi.fn();
    const { result } = renderHook(() =>
      useBottomholeDraw({
        projectId: 'p1',
        drawMode: 'bottomhole_lateral_nnb',
        infraObjects: [
          {
            id: 'pad-1',
            subtype: 'oil_pad',
            lon: 37.62,
            lat: 55.76,
          } as never,
          {
            id: 'main-1',
            subtype: 'well_bottomhole_nnb',
            lon: 37.621,
            lat: 55.761,
            properties: {
              well_bottomhole_linked_pad_id: 'pad-1',
              well_bottomhole_role: 'main',
            },
          } as never,
        ],
        canWriteInfra: true,
        nextAutoName: () => 'Lat-1',
        placeBottomholeAt,
        placeGsBottomholeAt,
        pushToast,
      }),
    );

    await act(async () => {
      await result.current.handleMapClickForBottomholeDraw(37.622, 55.762);
    });

    expect(placeBottomholeAt).toHaveBeenCalledWith(
      'well_bottomhole_nnb',
      37.622,
      55.762,
      expect.objectContaining({
        well_bottomhole_role: 'lateral',
        well_bottomhole_parent_id: 'main-1',
      }),
    );
  });
});
