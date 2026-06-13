import { AppModal } from '../AppModal';
import { templateSummaryLines } from './footprintConnectionTemplateUi';
import type { FootprintLineConnectionTemplate } from '../../lib/padFootprintLineAttach';

interface FootprintTemplateApplyConfirmModalProps {
  open: boolean;
  title: string;
  objectCount: number;
  template: FootprintLineConnectionTemplate;
  applying?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function FootprintTemplateApplyConfirmModal({
  open,
  title,
  objectCount,
  template,
  applying = false,
  onClose,
  onConfirm,
}: FootprintTemplateApplyConfirmModalProps) {
  if (!open) return null;

  const lines = templateSummaryLines(template);

  return (
    <AppModal
      title={title}
      titleId="footprint-template-apply-confirm-title"
      onClose={onClose}
      size="sm"
      closeOnBackdrop={!applying}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={applying}>
            Отмена
          </button>
          <button
            type="button"
            className="btn btn-primary"
            data-testid="footprint-template-apply-confirm"
            onClick={onConfirm}
            disabled={applying}
          >
            {applying ? 'Применение…' : 'Применить'}
          </button>
        </>
      }
    >
      <p className="footprint-connect-confirm__lead">
        Будет обновлено объектов: <strong>{objectCount}</strong>
      </p>
      {lines.length > 0 && (
        <ul className="footprint-connect-confirm__lines">
          {lines.map((line) => (
            <li key={line.lineSubtype} className="footprint-connect-confirm__line">
              <span
                className="footprint-connect-confirm__dot"
                style={{ backgroundColor: line.color }}
                aria-hidden
              />
              <span className="footprint-connect-confirm__line-label">{line.label}</span>
              <span className="footprint-connect-confirm__line-value">{line.summary}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="object-detail-panel__hint footprint-connect-confirm__hint">
        Отменить можно кнопкой «Отменить последнее применение» на этой странице или на карте (Ctrl+Z).
      </p>
    </AppModal>
  );
}
