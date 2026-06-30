import { Eye, Pencil } from 'lucide-react';
import { Button } from 'antd';

export function FlowSchematicMobileBanner({
  readOnly,
  isMobile,
  onEnableEdit,
  onDisableEdit,
}: {
  readOnly: boolean;
  isMobile: boolean;
  onEnableEdit: () => void;
  onDisableEdit: () => void;
}) {
  if (readOnly) {
    return (
      <div className="flow-mobile-view-banner">
        <Eye size={16} className="shrink-0 text-[var(--accent)]" aria-hidden />
        <span className="flex-1 min-w-0">
          Режим просмотра на телефоне. Для редактирования схемы используйте компьютер или включите
          редактирование.
        </span>
        <Button size="small" className="shrink-0" icon={<Pencil size={14} />} onClick={onEnableEdit}>
          Редактировать
        </Button>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="flow-mobile-view-banner">
        <Pencil size={16} className="shrink-0 text-[var(--primary)]" aria-hidden />
        <span className="flex-1 min-w-0">Режим редактирования на телефоне — упрощённая панель инструментов.</span>
        <Button type="text" size="small" className="shrink-0" icon={<Eye size={14} />} onClick={onDisableEdit}>
          Только просмотр
        </Button>
      </div>
    );
  }

  return null;
}
