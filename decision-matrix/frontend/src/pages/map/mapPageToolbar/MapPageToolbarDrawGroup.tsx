import { useRef } from 'react';
import { BoxSelect, MapPin, MousePointer2, Pencil, Route, Ruler } from 'lucide-react';
import { AnchoredMenu } from '../../../components/AnchoredMenu';
import type { DrawMode, SelectMode } from '../../../components/MapView';
import {
  LINE_SUBTYPES,
  MAP_DRAWABLE_POINT_SUBTYPES,
  SUBTYPE_LABELS,
} from '../../../lib/api';
import { iconDataUrl } from '../../../lib/mapIcons';
import { PointSubtypeMenuItem } from '../PointSubtypeMenuItem';

export type MapPageToolbarDrawGroupProps = {
  drawMode: DrawMode;
  onDrawModeChange: (mode: DrawMode) => void;
  selectMode: SelectMode;
  onSelectModeChange: (mode: SelectMode) => void;
  onResetDrawingMenus: () => void;
  canWriteInfra: boolean;
  canWriteProject: boolean;
  projectJobBusy: boolean;
  mapIn3d: boolean;
  infraFormSubtype: string;
  onInfraFormSubtypeChange: (subtype: string) => void;
  pointMenuOpen: boolean;
  onPointMenuOpenChange: (open: boolean) => void;
  lineMenuOpen: boolean;
  onLineMenuOpenChange: (open: boolean) => void;
  onClearLineDraft: () => void;
  onClearRuler: () => void;
};

export function MapPageToolbarDrawGroup({
  drawMode,
  onDrawModeChange,
  selectMode,
  onSelectModeChange,
  onResetDrawingMenus,
  canWriteInfra,
  canWriteProject,
  projectJobBusy,
  mapIn3d,
  infraFormSubtype,
  onInfraFormSubtypeChange,
  pointMenuOpen,
  onPointMenuOpenChange,
  lineMenuOpen,
  onLineMenuOpenChange,
  onClearLineDraft,
  onClearRuler,
}: MapPageToolbarDrawGroupProps) {
  const pointMenuAnchorRef = useRef<HTMLDivElement>(null);
  const lineMenuAnchorRef = useRef<HTMLDivElement>(null);

  const enterSelectSingle = () => {
    onSelectModeChange('single');
    onDrawModeChange('select');
    onClearLineDraft();
    onPointMenuOpenChange(false);
    onLineMenuOpenChange(false);
  };

  const enterSelectBox = () => {
    onSelectModeChange('box');
    onDrawModeChange('select');
    onClearLineDraft();
    onPointMenuOpenChange(false);
    onLineMenuOpenChange(false);
  };

  return (
    <div className="map-tools-group map-tools-group--draw">
      <div
        className="map-display-mode-toggle inline-flex rounded overflow-hidden"
        role="group"
        aria-label="Режим выбора"
      >
        <button
          type="button"
          className={`btn btn-sm map-tool-btn map-tool-btn--with-label rounded-none border-0 ${
            drawMode === 'select' && selectMode === 'single' ? 'btn-primary active' : 'btn-secondary'
          }`}
          title="Выбор одного объекта"
          aria-label="Один объект"
          aria-pressed={drawMode === 'select' && selectMode === 'single'}
          onClick={enterSelectSingle}
        >
          <MousePointer2 size={14} className="shrink-0" aria-hidden />
          <span className="map-tool-label">Объект</span>
        </button>
        <button
          type="button"
          className={`btn btn-sm map-tool-btn map-tool-btn--with-label rounded-none border-0 ${
            drawMode === 'select' && selectMode === 'box' ? 'btn-primary active' : 'btn-secondary'
          }`}
          title="Выбор группы объектов рамкой"
          aria-label="Группа объектов"
          aria-pressed={drawMode === 'select' && selectMode === 'box'}
          onClick={enterSelectBox}
        >
          <BoxSelect size={14} className="shrink-0" aria-hidden />
          <span className="map-tool-label">Группа</span>
        </button>
      </div>
      <button
        type="button"
        className={`btn btn-sm map-tool-btn map-tool-btn--with-label ${drawMode === 'autoroad_network' ? 'btn-primary active' : 'btn-secondary'}`}
        disabled={!canWriteInfra || mapIn3d || projectJobBusy}
        title={
          mapIn3d ? 'Только в режиме 2D' : 'Построить сеть автодорог между выбранными точками'
        }
        aria-label="Построить сеть автодорог"
        onClick={() => {
          if (drawMode === 'autoroad_network') {
            onDrawModeChange('select');
            return;
          }
          onResetDrawingMenus();
          onDrawModeChange('autoroad_network');
        }}
      >
        <Route size={14} className="shrink-0" aria-hidden />
        <span className="map-tool-label">Сеть</span>
      </button>
      <button
        type="button"
        className={`btn btn-sm map-tool-btn map-tool-btn--with-label ${drawMode === 'poi' ? 'btn-primary active' : 'btn-secondary'}`}
        disabled={!canWriteProject || mapIn3d}
        title={
          mapIn3d
            ? 'Рисование доступно только в режиме 2D'
            : !canWriteProject
              ? 'Создание POI недоступно в режиме просмотра'
              : 'Создать точку интереса'
        }
        aria-label="Точка интереса (POI)"
        onClick={() => {
          if (drawMode === 'poi') {
            onDrawModeChange('select');
            return;
          }
          onDrawModeChange('poi');
          onClearLineDraft();
          onPointMenuOpenChange(false);
          onLineMenuOpenChange(false);
        }}
      >
        <MapPin size={14} className="shrink-0" aria-hidden />
        <span className="map-tool-label">POI</span>
      </button>
      <div ref={pointMenuAnchorRef} className="inline-block">
        <button
          type="button"
          className={`btn btn-sm map-tool-btn map-tool-btn--with-label ${drawMode === 'point' || pointMenuOpen ? 'btn-primary active' : 'btn-secondary'}`}
          disabled={!canWriteInfra || mapIn3d}
          title={
            mapIn3d
              ? 'Рисование доступно только в режиме 2D'
              : !canWriteInfra
                ? 'Создание объектов недоступно в режиме просмотра'
                : 'Создать точечный объект'
          }
          aria-label="Точка"
          onClick={() => {
            if (drawMode === 'point') {
              onDrawModeChange('select');
              onPointMenuOpenChange(false);
              return;
            }
            if (pointMenuOpen) {
              onPointMenuOpenChange(false);
              return;
            }
            onClearLineDraft();
            onLineMenuOpenChange(false);
            onPointMenuOpenChange(true);
          }}
        >
          <MapPin size={14} className="shrink-0" aria-hidden />
          <span className="map-tool-label">Точка</span>
        </button>
        <AnchoredMenu
          anchorRef={pointMenuAnchorRef}
          open={pointMenuOpen}
          onClose={() => onPointMenuOpenChange(false)}
          width={220}
          className="app-anchored-menu--flat"
          ariaLabel="Тип точечного объекта"
        >
          {MAP_DRAWABLE_POINT_SUBTYPES.map((st) => (
            <PointSubtypeMenuItem
              key={st}
              st={st}
              selected={infraFormSubtype === st}
              onPick={(subtype) => {
                onInfraFormSubtypeChange(subtype);
                onPointMenuOpenChange(false);
                onDrawModeChange('point');
              }}
            />
          ))}
          <p
            className="px-3 py-2 text-xs border-t"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
          >
            Клик по линии — объект вставляется на трассу и делит её на две части.
          </p>
        </AnchoredMenu>
      </div>
      <div ref={lineMenuAnchorRef} className="inline-block">
        <button
          type="button"
          className={`btn btn-sm map-tool-btn map-tool-btn--with-label ${drawMode === 'line' || lineMenuOpen ? 'btn-primary active' : 'btn-secondary'}`}
          disabled={!canWriteInfra || mapIn3d}
          title={
            mapIn3d
              ? 'Рисование доступно только в режиме 2D'
              : !canWriteInfra
                ? 'Рисование линий недоступно в режиме просмотра'
                : 'Создать линейный объект'
          }
          aria-label="Линия"
          onClick={() => {
            if (drawMode === 'line') {
              onDrawModeChange('select');
              onClearLineDraft();
              onLineMenuOpenChange(false);
              return;
            }
            if (lineMenuOpen) {
              onLineMenuOpenChange(false);
              return;
            }
            onClearLineDraft();
            onPointMenuOpenChange(false);
            onLineMenuOpenChange(true);
          }}
        >
          <Pencil size={14} className="shrink-0" aria-hidden />
          <span className="map-tool-label">Линия</span>
        </button>
        <AnchoredMenu
          anchorRef={lineMenuAnchorRef}
          open={lineMenuOpen}
          onClose={() => onLineMenuOpenChange(false)}
          width={200}
          className="app-anchored-menu--flat"
          ariaLabel="Тип линейного объекта"
        >
          {LINE_SUBTYPES.map((st) => (
            <button
              key={st}
              type="button"
              className={`w-full text-left px-3 py-1.5 hover:bg-[var(--bg)] flex items-center gap-2 ${
                infraFormSubtype === st ? 'font-medium' : ''
              }`}
              onClick={() => {
                onInfraFormSubtypeChange(st);
                onLineMenuOpenChange(false);
                onDrawModeChange('line');
              }}
            >
              <img src={iconDataUrl(st)} alt="" className="w-4 h-4 shrink-0" draggable={false} />
              <span className="truncate">{SUBTYPE_LABELS[st] || st}</span>
            </button>
          ))}
        </AnchoredMenu>
      </div>
      <button
        type="button"
        className={`btn btn-sm map-tool-btn map-tool-btn--with-label ${drawMode === 'ruler' ? 'btn-primary active' : 'btn-secondary'}`}
        disabled={mapIn3d}
        title={
          mapIn3d
            ? 'Линейка доступна только в режиме 2D'
            : 'Измерить длину ломаной линии на карте (двойной клик — завершить)'
        }
        aria-label="Линейка"
        onClick={() => {
          if (drawMode === 'ruler') {
            onDrawModeChange('select');
            return;
          }
          onClearLineDraft();
          onClearRuler();
          onPointMenuOpenChange(false);
          onLineMenuOpenChange(false);
          onDrawModeChange('ruler');
        }}
      >
        <Ruler size={14} className="shrink-0" aria-hidden />
        <span className="map-tool-label">Линейка</span>
      </button>
    </div>
  );
}
