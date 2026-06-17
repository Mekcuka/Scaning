import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPointerFrameScheduler, pointerCoordsChanged } from './mapPointerThrottle';

describe('pointerCoordsChanged', () => {
  it('returns true when prev is null', () => {
    expect(pointerCoordsChanged(null, 37.6, 55.75)).toBe(true);
  });

  it('returns false for tiny movement within epsilon', () => {
    expect(pointerCoordsChanged({ lon: 1, lat: 2 }, 1 + 1e-8, 2)).toBe(false);
  });

  it('returns true when lon or lat moves beyond epsilon', () => {
    expect(pointerCoordsChanged({ lon: 1, lat: 2 }, 1.001, 2)).toBe(true);
    expect(pointerCoordsChanged({ lon: 1, lat: 2 }, 1, 2.001)).toBe(true);
  });
});

describe('createPointerFrameScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs at most once per animation frame', () => {
    const run = vi.fn();
    const scheduler = createPointerFrameScheduler(run);
    scheduler.schedule();
    scheduler.schedule();
    expect(run).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('cancel prevents pending run', () => {
    const run = vi.fn();
    const scheduler = createPointerFrameScheduler(run);
    scheduler.schedule();
    scheduler.cancel();
    vi.runAllTimers();
    expect(run).not.toHaveBeenCalled();
  });
});
