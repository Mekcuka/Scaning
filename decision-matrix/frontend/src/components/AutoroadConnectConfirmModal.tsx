import { AlertTriangle, Route } from 'lucide-react';
import { AppModal } from './AppModal';
import type { AutoroadPreviewSummary } from '../lib/autoroadConnectMessages';

export type AutoroadConfirmVariant = 'network' | 'connect';

type Props = {
  summary: AutoroadPreviewSummary;
  variant: AutoroadConfirmVariant;
  applying?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const TITLES: Record<AutoroadConfirmVariant, string> = {
  network: 'Построить сеть автодорог?',
  connect: 'Соединить автодорогами?',
};

export function AutoroadConnectConfirmModal({
  summary,
  variant,
  applying = false,
  onClose,
  onConfirm,
}: Props) {
  const hasWarnings =
    summary.planWarnings.length > 0 ||
    summary.terminalWarningCount > 0 ||
    summary.newLineCount === 0;

  return (
    <AppModal
      title={TITLES[variant]}
      titleId="autoroad-connect-confirm-title"
      onClose={onClose}
      size="sm"
      closeOnBackdrop={!applying}
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={applying}
          >
            Отмена
          </button>
          <button
            type="button"
            className="btn btn-primary"
            data-testid="autoroad-connect-confirm"
            onClick={onConfirm}
            disabled={applying}
          >
            {applying ? 'Применение…' : 'Применить'}
          </button>
        </>
      }
    >
      <div className="autoroad-confirm-intro">
        <Route size={18} className="autoroad-confirm-intro__icon" aria-hidden />
        <p className="text-sm mb-0">
          Проверьте результат расчёта. После применения на карту будут добавлены новые линии и узлы.
        </p>
      </div>

      <dl className="autoroad-confirm-stats">
        <div>
          <dt>Новых линий</dt>
          <dd>{summary.newLineCount}</dd>
        </div>
        <div>
          <dt>Новых узлов</dt>
          <dd>{summary.newNodeCount}</dd>
        </div>
        <div>
          <dt>Разрезов</dt>
          <dd>{summary.splitCount}</dd>
        </div>
        <div>
          <dt>Длина новых участков</dt>
          <dd>~{summary.totalNewKm.toFixed(2)} км</dd>
        </div>
      </dl>

      {summary.terminalWarningCount > 0 ? (
        <p className="text-xs autoroad-confirm-note">
          Объектов с предупреждением: {summary.terminalWarningCount}
          {summary.terminalWarningLabels.length > 0
            ? ` (${summary.terminalWarningLabels.join('; ')})`
            : ''}
        </p>
      ) : null}

      {hasWarnings ? (
        <div className="import-3d-alert import-3d-alert--warn autoroad-confirm-warn" role="status">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-sm font-medium mb-1">Обратите внимание</p>
            {summary.newLineCount === 0 ? (
              <p className="text-sm mb-1">Новых линий не будет — возможно, объекты уже связаны по сети.</p>
            ) : null}
            {summary.planWarnings.length > 0 ? (
              <ul className="autoroad-confirm-warn__list text-sm mb-0">
                {summary.planWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      <p className="text-xs autoroad-confirm-note mb-0">Отменить можно через Ctrl+Z после применения.</p>
    </AppModal>
  );
}
