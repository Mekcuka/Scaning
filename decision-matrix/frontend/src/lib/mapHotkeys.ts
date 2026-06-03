import { useEffect } from 'react';

export function isMapHotkeyTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export type MapHotkeyHandlers = {
  onEscape: () => void;
  onDelete: () => void;
  onToggleEdit: () => void;
  onFinishLine?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onCut?: () => void;
};

export type UseMapHotkeysOptions = MapHotkeyHandlers & {
  enabled?: boolean;
  canDelete?: boolean;
  canToggleEdit?: boolean;
  canCopy?: boolean;
  canPaste?: boolean;
  canCut?: boolean;
  drawMode: string;
};

export function useMapHotkeys({
  enabled = true,
  canDelete = false,
  canToggleEdit = false,
  drawMode,
  onEscape,
  onDelete,
  onToggleEdit,
  onFinishLine,
  onCopy,
  onPaste,
  onCut,
  canCopy = false,
  canPaste = false,
  canCut = false,
}: UseMapHotkeysOptions): void {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (isMapHotkeyTypingTarget(e.target)) return;

      if (e.key === 'Escape') {
        onEscape();
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && canDelete) {
        e.preventDefault();
        onDelete();
        return;
      }

      if ((e.key === 'e' || e.key === 'E') && canToggleEdit && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onToggleEdit();
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'c' && canCopy && onCopy) {
        e.preventDefault();
        onCopy();
        return;
      }
      if (mod && e.key.toLowerCase() === 'v' && canPaste && onPaste) {
        e.preventDefault();
        onPaste();
        return;
      }
      if (mod && e.key.toLowerCase() === 'x' && canCut && onCut) {
        e.preventDefault();
        onCut();
        return;
      }

      if (e.key === 'Enter' && drawMode === 'line' && onFinishLine) {
        e.preventDefault();
        onFinishLine();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    enabled,
    canDelete,
    canToggleEdit,
    drawMode,
    onEscape,
    onDelete,
    onToggleEdit,
    onFinishLine,
    onCopy,
    onPaste,
    onCut,
    canCopy,
    canPaste,
    canCut,
  ]);
}
