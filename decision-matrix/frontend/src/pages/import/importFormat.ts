export async function detectImportFormat(file: File): Promise<string> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.kml') || lower.endsWith('.kmz')) return 'kml';
  if (lower.endsWith('.zip')) return 'shp';
  if (lower.endsWith('.json') || lower.endsWith('.geojson')) {
    try {
      const head = await file.slice(0, 8192).text();
      if (
        head.includes('"type"') &&
        head.includes('"project"') &&
        head.includes('"objects"')
      ) {
        return 'spark';
      }
    } catch {
      /* use geojson */
    }
  }
  return 'geojson';
}

export type ImportPreviewRejectedRow = { row: string; name: string; reason: string };

export function parseImportPreviewErrors(errors: string[]): ImportPreviewRejectedRow[] {
  return errors
    .map((msg) => {
      const m = msg.match(/^Row\s+(\d+)\s+\((.+)\):\s+(.+)$/);
      if (!m) return null;
      return { row: m[1], name: m[2], reason: m[3] };
    })
    .filter(Boolean) as ImportPreviewRejectedRow[];
}
