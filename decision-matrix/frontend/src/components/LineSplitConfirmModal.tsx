import { GitBranch } from 'lucide-react';
import { AppModal } from './AppModal';
import type { LineSplitConfirmSummary } from '../lib/lineSplitConfirmMessages';

type Props = {
  summary: LineSplitConfirmSummary;
  onSkipSplit: () => void;
  onConfirmSplit: () => void;
};

export function LineSplitConfirmModal({ summary, onSkipSplit, onConfirmSplit }: Props) {
  const skipLabel = summary.scenario === 'line_finish' ? 'Только узел' : 'Только точка';
  const intro =
    summary.scenario === 'line_finish'
      ? `При завершении линии будет создан узел на «${summary.lineName}».`
      : `${summary.pointLabel} будет размещена на линии «${summary.lineName}».`;

  return (
    <AppModal
      title="Разделить линию?"
      titleId="line-split-confirm-title"
      onClose={onSkipSplit}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onSkipSplit}>
            {skipLabel}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            data-testid="line-split-confirm"
            onClick={onConfirmSplit}
          >
            Разделить линию
          </button>
        </>
      }
    >
      <div className="autoroad-confirm-intro">
        <GitBranch size={18} className="autoroad-confirm-intro__icon" aria-hidden />
        <p className="text-sm mb-0">{intro}</p>
      </div>

      <dl className="autoroad-confirm-stats">
        <div>
          <dt>Линия</dt>
          <dd>{summary.lineName}</dd>
        </div>
        <div>
          <dt>Тип</dt>
          <dd>{summary.lineSubtypeLabel}</dd>
        </div>
        <div>
          <dt>Вторая часть</dt>
          <dd>{summary.secondLineName}</dd>
        </div>
      </dl>

      <p className="text-xs mb-0" style={{ color: 'var(--text-muted)' }}>
        «{skipLabel}» — объект создаётся на линии без разделения. Отменить разбиение можно через Ctrl+Z
        после подтверждения.
      </p>
    </AppModal>
  );
}
