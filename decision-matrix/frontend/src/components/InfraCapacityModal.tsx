import { useEffect, useState } from 'react';
import { Button, Space } from 'antd';
import { AppModal } from './AppModal';
import { DeferredNumberInput } from './DeferredNumberInput';
import {
  capacityUnitLabel,
  defaultCapacityUnitForSubtype,
  effectiveThroughputCapacity,
} from '../lib/infraCapacity';

type Props = {
  open: boolean;
  objectName: string;
  subtype: string;
  properties: Record<string, unknown> | undefined | null;
  saving?: boolean;
  onClose: () => void;
  onApply: (value: number | null) => void;
};

export function InfraCapacityModal({
  open,
  objectName,
  subtype,
  properties,
  saving,
  onClose,
  onApply,
}: Props) {
  const effective = effectiveThroughputCapacity(subtype, properties);
  const unitLabel = capacityUnitLabel(effective.unit || defaultCapacityUnitForSubtype(subtype));
  const [draft, setDraft] = useState<number | ''>('');

  useEffect(() => {
    if (!open) return;
    setDraft(effective.value != null ? effective.value : '');
  }, [open, effective.value]);

  if (!open) return null;

  const handleApply = () => {
    onApply(draft === '' ? null : draft);
  };

  return (
    <AppModal
      title="Пропускная способность"
      titleId="infra-capacity-title"
      onClose={onClose}
      size="sm"
      footer={
        <Space className="w-full justify-end">
          <Button size="small" disabled={saving} onClick={onClose}>
            Отмена
          </Button>
          <Button type="primary" size="small" loading={saving} onClick={handleApply}>
            {saving ? 'Сохранение…' : 'Применить'}
          </Button>
        </Space>
      }
    >
      <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
        {objectName}
      </p>
      <label className="object-detail-panel__field">
        <span className="object-detail-panel__label">Значение ({unitLabel})</span>
        <DeferredNumberInput
          allowEmpty
          min={0}
          className="object-detail-panel__input"
          placeholder="Не задана"
          value={draft}
          disabled={saving}
          onCommit={(v) => setDraft(v === '' ? '' : typeof v === 'number' ? v : Number(v))}
        />
      </label>
      <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
        Enter — подтвердить в поле, затем «Применить» для сохранения на сервер.
      </p>
    </AppModal>
  );
}
