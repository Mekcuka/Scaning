import { useMemo } from 'react';
import type { DrawMode } from '../components/MapView';
import type { SelectedFeature } from '../components/ObjectDetailPanel';
import { isLineSubtype } from '../lib/infraGeometry';

export type UseMapFooterHintParams = {
  pasteMode: boolean;
  drawMode: DrawMode;
  mapEditEnabled: boolean;
  detailSelection: SelectedFeature | null;
  selectMode: 'single' | 'box';
  featureGroupCount: number;
  mapInFootprints?: boolean;
};

export function useMapFooterHint({
  pasteMode,
  drawMode,
  mapEditEnabled,
  detailSelection,
  selectMode,
  featureGroupCount,
  mapInFootprints = false,
}: UseMapFooterHintParams): string | null {
  return useMemo(() => {
    if (pasteMode) {
      return 'Кликните на карте — вставить · Esc — отмена';
    }
    if (drawMode === 'autoroad_network') {
      return 'Клик по точке — добавить/убрать терминал · панель справа — предпросмотр';
    }
    if (drawMode === 'pad_placement') {
      return 'Клик или рамка — выбрать забои · панель справа — расчёт и применение';
    }
    if (drawMode !== 'select') return null;
    const footprintHint = mapInFootprints
      ? 'Контуры площадок из параметров земляных работ'
      : null;
    if (mapEditEnabled) {
      if (
        detailSelection?.kind === 'infra' &&
        isLineSubtype(detailSelection.object.subtype)
      ) {
        return 'Перетащите вершину; двойной ЛКМ по средней — удалить; концы — на точечных объектах (точные координаты), иначе возврат · Del — удалить · Ctrl+Z — отмена';
      }
      if (detailSelection) {
        return 'Перетащите объект · Ctrl+C/V/X · Del · Ctrl+Z — отмена';
      }
      if (selectMode === 'box') {
        return featureGroupCount > 0
          ? 'Перетащите выделение · клик в пустое — снять выделение · Ctrl+C/V/X · Del · Ctrl+Z'
          : 'Рамка — выделить объекты · Ctrl+C/V/X';
      }
      if (footprintHint) return footprintHint;
      return 'Выберите объект или включите инструмент рисования · E — редактирование';
    }
    if (footprintHint) {
      return `${footprintHint} · Включите редактирование (E) для перемещения объектов`;
    }
    return 'Включите редактирование (E) для перемещения объектов';
  }, [drawMode, mapEditEnabled, detailSelection, selectMode, pasteMode, featureGroupCount, mapInFootprints]);
}
