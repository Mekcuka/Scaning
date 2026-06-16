import type { LineTubeBuildInput } from './map3dLineMeshes';
import { createLineTubeGroup } from './map3dLineMeshes';
import { groupFromSerializedTube, serializeLineTubeBuild } from './map3dLineTubeSerialize';

export type LineTubeBuildResult = NonNullable<ReturnType<typeof createLineTubeGroup>>;

type Pending = {
  resolve: (value: LineTubeBuildResult | null) => void;
};

let worker: Worker | null = null;
let workerDisabled = false;
let nextId = 1;
const pending = new Map<number, Pending>();

function ensureWorker(): Worker | null {
  if (workerDisabled || typeof Worker === 'undefined') return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./map3dLineGeometry.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event) => {
      const msg = event.data as { id: number; ok: boolean; data?: Parameters<typeof groupFromSerializedTube>[0]; error?: string };
      const job = pending.get(msg.id);
      if (!job) return;
      pending.delete(msg.id);
      if (!msg.ok || !msg.data) {
        job.resolve(null);
        return;
      }
      const group = groupFromSerializedTube(msg.data);
      job.resolve({
        group,
        anchorLon: msg.data.anchorLon,
        anchorLat: msg.data.anchorLat,
        anchorAlt: msg.data.anchorAlt,
      });
    };
    worker.onerror = () => {
      workerDisabled = true;
      worker?.terminate();
      worker = null;
      for (const job of pending.values()) job.resolve(null);
      pending.clear();
    };
    return worker;
  } catch {
    workerDisabled = true;
    return null;
  }
}

function buildSync(input: LineTubeBuildInput): LineTubeBuildResult | null {
  return createLineTubeGroup(input);
}

/** Async tube build — worker when available, sync fallback on error. */
export function buildLineTubeGroupAsync(
  input: LineTubeBuildInput,
): Promise<LineTubeBuildResult | null> {
  const w = ensureWorker();
  if (!w) return Promise.resolve(buildSync(input));

  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, { resolve: (result) => resolve(result ?? buildSync(input)) });
    w.postMessage({ id, input });
  });
}

export { createLineTubeGroup as buildLineTubeGroupSync, serializeLineTubeBuild };
