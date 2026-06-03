import { useCallback, useRef, useState } from 'react';
import { AutoroadConnectConfirmModal, type AutoroadConfirmVariant } from '../components/AutoroadConnectConfirmModal';
import {
  buildAutoroadPreviewSummary,
  type AutoroadPreviewSummary,
} from '../lib/autoroadConnectMessages';
import type { AutoroadConnectResult } from '../lib/api';

export function useAutoroadConnectConfirm() {
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);
  const [dialog, setDialog] = useState<{
    summary: AutoroadPreviewSummary;
    variant: AutoroadConfirmVariant;
  } | null>(null);

  const requestConfirm = useCallback(
    (preview: AutoroadConnectResult, variant: AutoroadConfirmVariant) =>
      new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
        setDialog({ summary: buildAutoroadPreviewSummary(preview), variant });
      }),
    [],
  );

  const finish = useCallback((ok: boolean) => {
    resolveRef.current?.(ok);
    resolveRef.current = null;
    setDialog(null);
  }, []);

  const modal =
    dialog != null ? (
      <AutoroadConnectConfirmModal
        summary={dialog.summary}
        variant={dialog.variant}
        onClose={() => finish(false)}
        onConfirm={() => finish(true)}
      />
    ) : null;

  return { requestConfirm, modal };
}
