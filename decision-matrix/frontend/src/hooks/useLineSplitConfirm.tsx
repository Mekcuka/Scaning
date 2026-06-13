import { useCallback, useRef, useState } from 'react';
import { LineSplitConfirmModal } from '../components/LineSplitConfirmModal';
import {
  buildLineSplitConfirmSummary,
  type LineSplitConfirmRequest,
  type LineSplitConfirmSummary,
} from '../lib/lineSplitConfirmMessages';

export function useLineSplitConfirm() {
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);
  const [dialog, setDialog] = useState<LineSplitConfirmSummary | null>(null);

  const requestConfirm = useCallback(
    (request: LineSplitConfirmRequest) =>
      new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
        setDialog(buildLineSplitConfirmSummary(request));
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
      <LineSplitConfirmModal
        summary={dialog}
        onSkipSplit={() => finish(false)}
        onConfirmSplit={() => finish(true)}
      />
    ) : null;

  return { requestConfirm, modal };
}
