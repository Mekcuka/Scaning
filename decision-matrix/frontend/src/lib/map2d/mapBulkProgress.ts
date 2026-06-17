/** Shared progress state for long-running map bulk operations (paste, delete). */
export type MapBulkProgressUpdate = {
  label: string;
  done: number;
  total: number;
  chunkIndex: number;
  chunkTotal: number;
  indeterminate: boolean;
};

export function bulkOperationTimeoutMs(total: number): number {
  return Math.min(300_000, Math.max(120_000, 45_000 + total * 70));
}
