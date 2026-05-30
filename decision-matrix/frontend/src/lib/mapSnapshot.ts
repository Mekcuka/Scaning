/** Capture OpenLayers map canvas as PNG data URL for PPTX export. */
export function captureMapSnapshot(container: HTMLElement | null): string | null {
  if (!container) return null;
  const canvas = container.querySelector('canvas') as HTMLCanvasElement | null;
  if (!canvas) return null;
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
