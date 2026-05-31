/** Finish coordinates for line drawing from draft preview (extracted for unit tests). */
export function lineDraftFinishCoordinates(
  preview: [number, number] | null | undefined,
): { lon: number; lat: number } | undefined {
  if (!preview) return undefined;
  return { lon: preview[0], lat: preview[1] };
}
