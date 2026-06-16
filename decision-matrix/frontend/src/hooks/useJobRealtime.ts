import { useEffect, useRef, useState } from 'react';

import type { JobStepResponse } from '../lib/api/jobs';
import { createJobWebSocket, type JobWebSocketClient } from '../lib/realtime/createJobWebSocket';
import { useTaskLogStore } from '../lib/taskLog/store';
import { useAppStore } from '../store';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);

function asStep(value: unknown): JobStepResponse | null {
  if (!value || typeof value !== 'object') return null;
  const step = value as Record<string, unknown>;
  if (typeof step.id !== 'string' || typeof step.seq !== 'number') return null;
  return step as JobStepResponse;
}

/**
 * Connects to job WebSocket and feeds taskLog store.
 * Polling fallback is handled by useActiveProjectJob when WS is disconnected.
 */
export function useJobRealtime(projectId: string | null | undefined) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<Record<string, unknown> | null>(null);
  const clientRef = useRef<JobWebSocketClient | null>(null);
  const patchJob = useTaskLogStore((s) => s.patchJob);
  const updateStep = useTaskLogStore((s) => s.updateStep);
  const pushToast = useAppStore((s) => s.pushToast);

  useEffect(() => {
    if (!projectId) return;

    const client = createJobWebSocket(projectId, {
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
      onEvent: (event) => {
        setLastEvent(event);
        const type = event.type as string | undefined;
        if (!type) return;

        const jobId = event.job_id as string | undefined;
        const evtProjectId = (event.project_id as string | undefined) ?? projectId;
        if (!jobId) return;

        if (type === 'job.step_added' || type === 'job.step_updated') {
          const step = asStep(event.step);
          if (step) updateStep(evtProjectId, jobId, step);
          return;
        }

        if (type === 'job.status_changed' || type === 'job.progress' || type === 'job.result') {
          patchJob(evtProjectId, jobId, {
            status: typeof event.status === 'string' ? event.status : undefined,
            progress: typeof event.progress === 'number' ? event.progress : undefined,
            error_message:
              typeof event.error_message === 'string'
                ? event.error_message
                : event.error_message === null
                  ? null
                  : undefined,
          });
        }

        if (type === 'job.result' && typeof event.status === 'string' && TERMINAL_STATUSES.has(event.status)) {
          if (event.status === 'completed') {
            pushToast('success', 'Расчёт завершён');
          } else if (event.status === 'failed') {
            pushToast('error', 'Расчёт завершился с ошибкой');
          } else if (event.status === 'cancelled') {
            pushToast('info', 'Расчёт отменён');
          }
        }
      },
    });
    clientRef.current = client;

    return () => {
      client.close();
      clientRef.current = null;
      setConnected(false);
    };
  }, [projectId, patchJob, updateStep, pushToast]);

  return {
    connected,
    lastEvent,
    readyState: clientRef.current?.readyState ?? 0,
  };
}
