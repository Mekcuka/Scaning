import { useActiveProjectJob } from '../hooks/useActiveProjectJob';
import { useJobRealtime } from '../hooks/useJobRealtime';

/** Single WebSocket + optional /jobs/active fallback for the active project. */
export function ProjectJobSync({ projectId }: { projectId: string | null }) {
  const { connected } = useJobRealtime(projectId ?? undefined);
  useActiveProjectJob(projectId, { realtimeConnected: connected });
  return null;
}
