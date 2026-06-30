import type { ComponentProps, ReactNode } from 'react';
import { Button } from 'antd';

type Props = {
  active?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
} & Omit<ComponentProps<typeof Button>, 'type' | 'size' | 'icon' | 'children'>;

/** Кнопка тулбара карты с legacy-классами `map-tool-btn`. */
export function MapToolbarButton({
  active = false,
  className = '',
  icon,
  children,
  ...rest
}: Props) {
  return (
    <Button
      size="small"
      type={active ? 'primary' : 'default'}
      className={`map-tool-btn map-tool-btn--with-label ${active ? 'active' : ''} ${className}`.trim()}
      icon={icon}
      {...rest}
    >
      {children}
    </Button>
  );
}
