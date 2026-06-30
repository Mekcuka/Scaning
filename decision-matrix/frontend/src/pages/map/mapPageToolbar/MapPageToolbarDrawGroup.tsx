import { useRef } from 'react';
import { BoxSelect, CircleDot, LayoutGrid, MapPin, MousePointer2, Pencil, Route, Ruler } from 'lucide-react';
import { AnchoredMenu } from '../../../components/AnchoredMenu';
import type { DrawMode, SelectMode } from '../../../components/MapView';
import {
  MAP_DRAWABLE_LINE_SUBTYPES,
  MAP_DRAWABLE_POINT_SUBTYPES,
  SUBTYPE_LABELS,
} from '../../../lib/api';
import { iconDataUrl } from '../../../lib/mapIcons';
import { GS_HEEL_LABEL, GS_TOE_LABEL } from '../../../lib/wellBottomholeProperties';
import { PointSubtypeMenuItem } from '../PointSubtypeMenuItem';
import { MapToolbarButton } from './MapToolbarButton';

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
  bottomholeMenuOpen: boolean;
  onBottomholeMenuOpenChange: (open: boolean) => void;
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
  bottomholeMenuOpen,
  onBottomholeMenuOpenChange,
  onClearLineDraft,
  onClearRuler,
}: MapPageToolbarDrawGroupProps) {
  const pointMenuAnchorRef = useRef<HTMLDivElement>(null);
  const lineMenuAnchorRef = useRef<HTMLDivElement>(null);
  const bottomholeMenuAnchorRef = useRef<HTMLDivElement>(null);

  const enterSelectSingle = () => {
    onSelectModeChange('single');
    onDrawModeChange('select');
    onClearLineDraft();
    onPointMenuOpenChange(false);
    onLineMenuOpenChange(false);
    onBottomholeMenuOpenChange(false);
  };

  const enterSelectBox = () => {
    onSelectModeChange('box');
    onDrawModeChange('select');
    onClearLineDraft();
    onPointMenuOpenChange(false);
    onLineMenuOpenChange(false);
    onBottomholeMenuOpenChange(false);
  };

  const enterBottomholeMode = (mode: 'bottomhole_nnb' | 'bottomhole_gs' | 'bottomhole_lateral_nnb' | 'bottomhole_lateral_gs') => {
    onResetDrawingMenus();
    onPointMenuOpenChange(false);
    onLineMenuOpenChange(false);
    onBottomholeMenuOpenChange(false);
    onClearLineDraft();
    onDrawModeChange(mode);
  };

  const bottomholeActive =
    drawMode === 'bottomhole_nnb' ||
    drawMode === 'bottomhole_gs' ||
    drawMode === 'bottomhole_lateral_nnb' ||
    drawMode === 'bottomhole_lateral_gs' ||
    bottomholeMenuOpen;

  return (
    <div className="map-tools-group map-tools-group--draw">
      <div
        className="map-display-mode-toggle inline-flex rounded overflow-hidden"
        role="group"
        aria-label="Режим выбора"
      >
        <MapToolbarButton
          active={drawMode === 'select' && selectMode === 'single'}
          className="rounded-none border-0"
          title="Выбор одного объекта"
          aria-label="Один объект"
          aria-pressed={drawMode === 'select' && selectMode === 'single'}
          onClick={enterSelectSingle}
        >
          <MousePointer2 size={14} className="shrink-0" aria-hidden />
          <span className="map-tool-label">Объект</span>
        </MapToolbarButton>
        <MapToolbarButton
          active={drawMode === 'select' && selectMode === 'box'}
          className="rounded-none border-0"
          title="Выбор группы объектов рамкой"
          aria-label="Группа объектов"
          aria-pressed={drawMode === 'select' && selectMode === 'box'}
          onClick={enterSelectBox}
        >
          <BoxSelect size={14} className="shrink-0" aria-hidden />
          <span className="map-tool-label">Группа</span>
        </MapToolbarButton>
      </div>
      <MapToolbarButton
        active={drawMode === 'autoroad_network'}
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
      </MapToolbarButton>
      <MapToolbarButton
        active={drawMode === 'pad_placement'}
        disabled={!canWriteInfra || mapIn3d || projectJobBusy}
        title={
          mapIn3d
            ? 'Только в режиме 2D'
            : 'Оптимизация размещения кустов по выбранным забоям'
        }
        aria-label="Оптимизация кустов"
        onClick={() => {
          if (drawMode === 'pad_placement') {
            onDrawModeChange('select');
            return;
          }
          onResetDrawingMenus();
          onDrawModeChange('pad_placement');
        }}
      >
        <LayoutGrid size={14} className="shrink-0" aria-hidden />
        <span className="map-tool-label">Кусты</span>
      </MapToolbarButton>
      <MapToolbarButton
        active={drawMode === 'poi'}
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
          onBottomholeMenuOpenChange(false);
        }}
      >
        <MapPin size={14} className="shrink-0" aria-hidden />
        <span className="map-tool-label">POI</span>
      </MapToolbarButton>
      <div ref={bottomholeMenuAnchorRef} className="inline-block">
        <MapToolbarButton
          active={bottomholeActive}
          disabled={!canWriteInfra || mapIn3d}
          title={
            mapIn3d
              ? 'Рисование доступно только в режиме 2D'
              : 'Разместить забой скважины (ННБ или ГС)'
          }
          aria-label="Забой скважины"
          onClick={() => {
            if (
              drawMode === 'bottomhole_nnb' ||
              drawMode === 'bottomhole_gs' ||
              drawMode === 'bottomhole_lateral_nnb' ||
              drawMode === 'bottomhole_lateral_gs'
            ) {
              onDrawModeChange('select');
              onBottomholeMenuOpenChange(false);
              return;
            }
            if (bottomholeMenuOpen) {
              onBottomholeMenuOpenChange(false);
              return;
            }
            onClearLineDraft();
            onPointMenuOpenChange(false);
            onLineMenuOpenChange(false);
            onBottomholeMenuOpenChange(true);
          }}
        >
          <CircleDot size={14} className="shrink-0" aria-hidden />
          <span className="map-tool-label">Забой</span>
        </MapToolbarButton>
        <AnchoredMenu
          anchorRef={bottomholeMenuAnchorRef}
          open={bottomholeMenuOpen}
          onClose={() => onBottomholeMenuOpenChange(false)}
          width={220}
          className="app-anchored-menu--flat"
          ariaLabel="Тип забоя скважины"
        >
          <button
            type="button"
            className={`w-full text-left px-3 py-1.5 hover:bg-[var(--bg)] flex items-center gap-2 ${
              drawMode === 'bottomhole_nnb' ? 'font-medium' : ''
            }`}
            onClick={() => enterBottomholeMode('bottomhole_nnb')}
          >
            <img
              src={iconDataUrl('well_bottomhole_nnb')}
              alt=""
              className="w-4 h-4 shrink-0"
              draggable={false}
            />
            <span className="truncate">{SUBTYPE_LABELS.well_bottomhole_nnb ?? 'Забой (ННБ)'}</span>
          </button>
          <button
            type="button"
            className={`w-full text-left px-3 py-1.5 hover:bg-[var(--bg)] flex items-center gap-2 ${
              drawMode === 'bottomhole_gs' ? 'font-medium' : ''
            }`}
            onClick={() => enterBottomholeMode('bottomhole_gs')}
          >
            <img
              src={iconDataUrl('well_bottomhole_gs')}
              alt=""
              className="w-4 h-4 shrink-0"
              draggable={false}
            />
            <span className="truncate">ГС</span>
          </button>
          <button
            type="button"
            className={`w-full text-left px-3 py-1.5 hover:bg-[var(--bg)] flex items-center gap-2 ${
              drawMode === 'bottomhole_lateral_nnb' ? 'font-medium' : ''
            }`}
            onClick={() => enterBottomholeMode('bottomhole_lateral_nnb')}
          >
            <img
              src={iconDataUrl('well_bottomhole_lateral')}
              alt=""
              className="w-4 h-4 shrink-0"
              draggable={false}
            />
            <span className="truncate">Доп.ствол (ННБ)</span>
          </button>
          <button
            type="button"
            className={`w-full text-left px-3 py-1.5 hover:bg-[var(--bg)] flex items-center gap-2 ${
              drawMode === 'bottomhole_lateral_gs' ? 'font-medium' : ''
            }`}
            onClick={() => enterBottomholeMode('bottomhole_lateral_gs')}
          >
            <img
              src={iconDataUrl('well_bottomhole_lateral')}
              alt=""
              className="w-4 h-4 shrink-0"
              draggable={false}
            />
            <span className="truncate">Доп.ствол (ГС)</span>
          </button>
          <p
            className="px-3 py-2 text-xs border-t"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
          >
            ННБ — один клик. ГС — первый клик {GS_HEEL_LABEL}, второй {GS_TOE_LABEL}. Доп.ствол привязывается к ближайшему основному забою на кусте.
          </p>
        </AnchoredMenu>
      </div>
      <div ref={pointMenuAnchorRef} className="inline-block">
        <MapToolbarButton
          active={drawMode === 'point' || pointMenuOpen}
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
            onBottomholeMenuOpenChange(false);
            onPointMenuOpenChange(true);
          }}
        >
          <MapPin size={14} className="shrink-0" aria-hidden />
          <span className="map-tool-label">Точка</span>
        </MapToolbarButton>
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
        <MapToolbarButton
          active={drawMode === 'line' || lineMenuOpen}
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
            onBottomholeMenuOpenChange(false);
            onLineMenuOpenChange(true);
          }}
        >
          <Pencil size={14} className="shrink-0" aria-hidden />
          <span className="map-tool-label">Линия</span>
        </MapToolbarButton>
        <AnchoredMenu
          anchorRef={lineMenuAnchorRef}
          open={lineMenuOpen}
          onClose={() => onLineMenuOpenChange(false)}
          width={200}
          className="app-anchored-menu--flat"
          ariaLabel="Тип линейного объекта"
        >
          {MAP_DRAWABLE_LINE_SUBTYPES.map((st) => (
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
      <MapToolbarButton
        active={drawMode === 'ruler'}
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
          onBottomholeMenuOpenChange(false);
          onDrawModeChange('ruler');
        }}
      >
        <Ruler size={14} className="shrink-0" aria-hidden />
        <span className="map-tool-label">Линейка</span>
      </MapToolbarButton>
    </div>
  );
}
