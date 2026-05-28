import { useEffect, useId, useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { computeAnchoredMenuPosition, type AnchoredMenuPosition } from '../lib/anchoredMenu';

type Props = {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  menuAlign?: 'left' | 'right';
  /** Fixed menu width (px). Left edge aligns to anchor. */
  width?: number;
  role?: string;
  ariaLabel?: string;
};

export function AnchoredMenu({
  anchorRef,
  open,
  onClose,
  children,
  className = '',
  menuAlign = 'left',
  width,
  role,
  ariaLabel,
}: Props) {
  const menuId = useId();
  const [pos, setPos] = useState<AnchoredMenuPosition | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      setPos(
        computeAnchoredMenuPosition(anchor, {
          menuAlign,
          minWidth: width ? Math.max(width, anchor.getBoundingClientRect().width) : undefined,
        })
      );
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchorRef, menuAlign, width]);

  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      const menu = document.getElementById(menuId);
      if (menu?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchorRef, menuId]);

  if (!open || !pos || typeof document === 'undefined') return null;

  return createPortal(
    <div
      id={menuId}
      role={role}
      aria-label={ariaLabel}
      className={`app-anchored-menu ${className}`.trim()}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        minWidth: pos.minWidth,
        width: width ?? undefined,
        transform: pos.openUp ? 'translateY(-100%)' : undefined,
        zIndex: 1200,
      }}
    >
      {children}
    </div>,
    document.body
  );
}
