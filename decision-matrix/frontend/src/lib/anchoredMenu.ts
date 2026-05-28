export const ANCHORED_MENU_GAP = 6;
export const ANCHORED_MENU_MAX_H = 280;

export type AnchoredMenuPosition = {
  top: number;
  left: number;
  minWidth: number;
  openUp: boolean;
};

export function computeAnchoredMenuPosition(
  anchor: HTMLElement,
  options: { menuAlign?: 'left' | 'right'; minWidth?: number } = {}
): AnchoredMenuPosition {
  const rect = anchor.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const openUp =
    spaceBelow < Math.min(ANCHORED_MENU_MAX_H, 160) && rect.top > spaceBelow;
  const minWidth = options.minWidth ?? rect.width;
  let left = rect.left;
  if (options.menuAlign === 'right') {
    left = rect.right - minWidth;
  }
  left = Math.max(8, Math.min(left, window.innerWidth - minWidth - 8));
  return {
    top: openUp ? rect.top - ANCHORED_MENU_GAP : rect.bottom + ANCHORED_MENU_GAP,
    left,
    minWidth,
    openUp,
  };
}
