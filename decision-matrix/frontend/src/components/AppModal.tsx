import type { ReactNode } from 'react';
import { Modal } from 'antd';

interface AppModalProps {
  title?: string;
  subtitle?: string;
  titleId?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  centered?: boolean;
  closeOnBackdrop?: boolean;
  overlayClassName?: string;
}

const MODAL_WIDTH: Record<NonNullable<AppModalProps['size']>, number> = {
  xs: 360,
  sm: 480,
  md: 640,
  lg: 900,
};

export function AppModal({
  title,
  subtitle,
  titleId,
  onClose,
  children,
  footer,
  size = 'md',
  centered = true,
  closeOnBackdrop = true,
  overlayClassName,
}: AppModalProps) {
  const titleNode =
    title || subtitle ? (
      <div id={titleId} className="app-modal-header__text">
        {title ? <span className="app-modal-header__title">{title}</span> : null}
        {subtitle ? <p className="app-modal-subtitle">{subtitle}</p> : null}
      </div>
    ) : undefined;

  return (
    <Modal
      open
      title={titleNode}
      onCancel={onClose}
      footer={footer !== undefined ? footer : null}
      width={MODAL_WIDTH[size]}
      centered={centered}
      destroyOnHidden
      maskClosable={closeOnBackdrop}
      wrapClassName={[
        'app-modal-overlay',
        subtitle ? 'app-modal--with-subtitle' : '',
        overlayClassName,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </Modal>
  );
}
