import { serializeLineTubeBuild, type LineTubeSerialized } from './map3dLineTubeSerialize';
import type { LineTubeBuildInput } from './map3dLineMeshes';

export type LineTubeWorkerRequest = {
  id: number;
  input: LineTubeBuildInput;
};

export type LineTubeWorkerResponse = {
  id: number;
  ok: boolean;
  data?: LineTubeSerialized;
  error?: string;
};

self.onmessage = (event: MessageEvent<LineTubeWorkerRequest>) => {
  const { id, input } = event.data;
  try {
    const data = serializeLineTubeBuild(input);
    if (!data) {
      const response: LineTubeWorkerResponse = { id, ok: false };
      self.postMessage(response);
      return;
    }
    const transfer: Transferable[] = [data.position.buffer, data.normal.buffer];
    if (data.index) transfer.push(data.index.buffer);
    const response: LineTubeWorkerResponse = { id, ok: true, data };
    self.postMessage(response, transfer);
  } catch (err) {
    const response: LineTubeWorkerResponse = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};

export {};
