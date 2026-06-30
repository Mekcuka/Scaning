import type { ReactNode } from 'react';
import { Modal, Typography } from 'antd';

interface AppModalProps {
  title?: string;
  subtitle?: string;
  titleId?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  closeOnBackdrop?: boolean;
  overlayClassName?: string;
}

const MODAL_WIDTH: Record<NonNullable<AppModalProps['size']>, number> = {
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
  closeOnBackdrop = true,
  overlayClassName,
}: AppModalProps) {
  const titleNode =
    title || subtitle ? (
      <div id={titleId}>
        {title ? <span>{title}</span> : null}
        {subtitle ? (
          <Typography.Text type="secondary" className="block mt-1 text-sm font-normal">
            {subtitle}
          </Typography.Text>
        ) : null}
      </div>
    ) : undefined;

  return (
    <Modal
      open
      title={titleNode}
      onCancel={onClose}
      footer={footer !== undefined ? footer : null}
      width={MODAL_WIDTH[size]}
      destroyOnHidden
      maskClosable={closeOnBackdrop}
      wrapClassName={['app-modal-overlay', overlayClassName].filter(Boolean).join(' ')}
    >
      {children}
    </Modal>
  );
}
