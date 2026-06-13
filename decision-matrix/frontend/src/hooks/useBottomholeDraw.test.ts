import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBottomholeDraw } from './useBottomholeDraw';

describe('useBottomholeDraw', () => {
  it('creates NNB on single click', async () => {
    const placeBottomholeAt = vi.fn().mockResolvedValue({ id: 'bh-1', name: 'BH-1' });
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

  it('requires two clicks for GS (heel then toe)', async () => {
    const placeBottomholeAt = vi
      .fn()
      .mockResolvedValueOnce({ id: 'heel-1', name: 'Heel' })
      .mockResolvedValueOnce({ id: 'toe-1', name: 'Toe' });
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
        pushToast,
      }),
    );

    await act(async () => {
      await result.current.handleMapClickForBottomholeDraw(37.621, 55.761);
    });
    expect(placeBottomholeAt).toHaveBeenCalledTimes(1);
    expect(result.current.gsHeelDraft?.id).toBe('heel-1');

    await act(async () => {
      await result.current.handleMapClickForBottomholeDraw(37.622, 55.761);
    });
    expect(placeBottomholeAt).toHaveBeenCalledTimes(2);
    expect(result.current.gsHeelDraft).toBeNull();
  });

  it('creates NNB without pad when none on map', async () => {
    const placeBottomholeAt = vi.fn().mockResolvedValue({ id: 'bh-1', name: 'BH-1' });
    const pushToast = vi.fn();
    const { result } = renderHook(() =>
      useBottomholeDraw({
        projectId: 'p1',
        drawMode: 'bottomhole_nnb',
        infraObjects: [],
        canWriteInfra: true,
        nextAutoName: () => 'BH-1',
        placeBottomholeAt,
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
});
