import { useEffect, useState } from 'react';
import { AppModal } from '../AppModal';
import { DeferredNumberInput } from '../DeferredNumberInput';
import { RANKING_DEFAULT_EXPERT } from '../../lib/api';

type ExpertDefaults = {
  risk?: number;
  reliability?: number;
  time_months?: number;
};

type Props = {
  open: boolean;
  defaults: ExpertDefaults;
  saving?: boolean;
  onClose: () => void;
  onApply: (defaults: ExpertDefaults) => void;
};

export function RankingExpertDefaultsModal({
  open,
  defaults,
  saving,
  onClose,
  onApply,
}: Props) {
  const [local, setLocal] = useState<ExpertDefaults>(defaults);

  useEffect(() => {
    if (open) {
      setLocal({
        risk: defaults.risk ?? RANKING_DEFAULT_EXPERT.risk,
        reliability: defaults.reliability ?? RANKING_DEFAULT_EXPERT.reliability,
        time_months: defaults.time_months ?? RANKING_DEFAULT_EXPERT.time_months,
      });
    }
  }, [open, defaults]);

  if (!open) return null;

  const patch = (key: keyof ExpertDefaults, value: number) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <AppModal
      title="Дефолты экспертных оценок"
      titleId="ranking-defaults-modal-title"
      onClose={onClose}
      size="sm"
      footer={
        <div className="flex gap-2 justify-end w-full">
          <button type="button" className="btn btn-secondary btn-sm" disabled={saving} onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={saving}
            onClick={() => onApply(local)}
          >
            {saving ? 'Сохранение…' : 'Применить'}
          </button>
        </div>
      }
    >
      <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
        Используются для пустых ячеек в экспертной матрице.
      </p>
      <div className="ranking-defaults grid grid-cols-1 gap-3">
        <label className="form-group">
          <span>Риск (1–10)</span>
          <DeferredNumberInput
            value={local.risk ?? 5}
            min={1}
            max={10}
            integer
            onCommit={(v) => patch('risk', Number(v))}
          />
        </label>
        <label className="form-group">
          <span>Надёжность (1–10)</span>
          <DeferredNumberInput
            value={local.reliability ?? 5}
            min={1}
            max={10}
            integer
            onCommit={(v) => patch('reliability', Number(v))}
          />
        </label>
        <label className="form-group">
          <span>Время (мес.)</span>
          <DeferredNumberInput
            value={local.time_months ?? 12}
            min={1}
            max={120}
            integer
            onCommit={(v) => patch('time_months', Number(v))}
          />
        </label>
      </div>
    </AppModal>
  );
}
