export function sanitizeExportBasename(name: string): string {
  const base = name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || 'export';
}

export function exportDateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function projectExportFilename(projectName: string, kind: string, ext: string): string {
  const normalizedExt = ext.startsWith('.') ? ext : `.${ext}`;
  const base = sanitizeExportBasename(`${projectName}-${kind}-${exportDateStamp()}`);
  if (base.toLowerCase().endsWith(normalizedExt.toLowerCase())) {
    return base;
  }
  return `${base}${normalizedExt}`;
}
