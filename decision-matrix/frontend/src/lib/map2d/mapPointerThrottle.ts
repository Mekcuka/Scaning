/** Coalesce high-frequency pointer work to one callback per animation frame. */
export function createPointerFrameScheduler(run: () => void) {
  let rafId: number | null = null;

  const schedule = () => {
    if (rafId != null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      run();
    });
  };

  const cancel = () => {
    if (rafId == null) return;
    cancelAnimationFrame(rafId);
    rafId = null;
  };

  return { schedule, cancel };
}

/** Skip parent callbacks when lon/lat barely moved (degrees). */
export function pointerCoordsChanged(
  prev: { lon: number; lat: number } | null,
  lon: number,
  lat: number,
  epsilon = 1e-7,
): boolean {
  if (!prev) return true;
  return Math.abs(prev.lon - lon) > epsilon || Math.abs(prev.lat - lat) > epsilon;
}
