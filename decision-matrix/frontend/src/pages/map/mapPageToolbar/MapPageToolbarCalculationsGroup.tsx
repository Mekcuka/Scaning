import { useRef, useState } from 'react';
import { Calculator, ChevronDown, LayoutGrid, LineChart, Route, Zap } from 'lucide-react';
import { AnchoredMenu } from '../../../components/AnchoredMenu';
import type { DrawMode } from '../../../components/MapView';
import { MapToolbarButton } from './MapToolbarButton';

export type MapPageToolbarCalculationsGroupProps = {
  projectId: string | undefined;
  poisCount: number;
  selectedPoiId: string | null;
  selectedPoiName: string | null;
  canWriteProject: boolean;
  canWriteInfra: boolean;
  analyzePending: boolean;
  onAnalyzeAll: () => void;
  onAnalyzeSelected: () => void;
  drawMode: DrawMode;
  onDrawModeChange: (mode: DrawMode) => void;
  onResetDrawingMenus: () => void;
  projectJobBusy: boolean;
  mapIn3d: boolean;
  lineProfileComputePending?: boolean;
  onLineProfileCompute?: () => void;
};

function menuItemClass(active: boolean, disabled?: boolean): string {
  return [
    'w-full text-left px-3 py-1.5 flex items-center gap-2',
    disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[var(--bg)]',
    active ? 'font-medium' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function MapPageToolbarCalculationsGroup({
  projectId,
  poisCount,
  selectedPoiId,
  selectedPoiName,
  canWriteProject,
  canWriteInfra,
  analyzePending,
  onAnalyzeAll,
  onAnalyzeSelected,
  drawMode,
  onDrawModeChange,
  onResetDrawingMenus,
  projectJobBusy,
  mapIn3d,
  lineProfileComputePending = false,
  onLineProfileCompute,
}: MapPageToolbarCalculationsGroupProps) {
  const menuAnchorRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const showAnalyze = Boolean(projectId) && canWriteProject;
  const analyzeAllDisabled = poisCount === 0 || analyzePending;
  const showAnalyzeSelected = showAnalyze && poisCount > 1;
  const canNetwork = canWriteInfra;
  const canPads = canWriteInfra;

  if (!showAnalyze && !canNetwork && !canPads) return null;

  const calcModeActive = drawMode === 'autoroad_network' || drawMode === 'pad_placement';

  const closeMenu = () => setMenuOpen(false);

  const enterAutoroad = () => {
    closeMenu();
    if (drawMode === 'autoroad_network') {
      onDrawModeChange('select');
      return;
    }
    onResetDrawingMenus();
    onDrawModeChange('autoroad_network');
  };

  const enterPads = () => {
    closeMenu();
    if (drawMode === 'pad_placement') {
      onDrawModeChange('select');
      return;
    }
    onResetDrawingMenus();
    onDrawModeChange('pad_placement');
  };

  const networkDisabled = mapIn3d || projectJobBusy || analyzePending;
  const padsDisabled = mapIn3d || projectJobBusy || analyzePending;
  const profileDisabled = mapIn3d || projectJobBusy || analyzePending || lineProfileComputePending;
  const analyzeSelectedDisabled = !selectedPoiId || analyzePending;

  return (
    <div className="map-tools-group map-tools-group--calculations">
      <div ref={menuAnchorRef} className="inline-block">
        <MapToolbarButton
          active={calcModeActive || menuOpen}
          loading={analyzePending || lineProfileComputePending}
          title="Запуск расчётов"
          aria-label="Расчёт"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Calculator size={14} className="shrink-0" aria-hidden />
          <span className="map-tool-label">Расчёт</span>
          <ChevronDown size={12} className="shrink-0 opacity-70" aria-hidden />
        </MapToolbarButton>
        <AnchoredMenu
          anchorRef={menuAnchorRef}
          open={menuOpen}
          onClose={closeMenu}
          width={260}
          className="app-anchored-menu--flat"
          ariaLabel="Расчёты"
        >
          {showAnalyze && (
            <button
              type="button"
              className={menuItemClass(false, analyzeAllDisabled)}
              disabled={analyzeAllDisabled}
              title={
                poisCount === 0
                  ? 'На карте нет точек интереса'
                  : poisCount > 1
                    ? `Пересчитать анализ для всех ${poisCount} точек интереса`
                    : 'Пересчитать анализ окружения'
              }
              onClick={() => {
                closeMenu();
                onAnalyzeAll();
              }}
            >
              <Zap size={14} className="shrink-0" aria-hidden />
              <span className="truncate">
                {analyzePending
                  ? 'Расчёт…'
                  : poisCount > 1
                    ? `Анализ всех точек (${poisCount})`
                    : 'Анализ окружения'}
              </span>
            </button>
          )}
          {showAnalyzeSelected && (
            <button
              type="button"
              className={menuItemClass(false, analyzeSelectedDisabled)}
              disabled={analyzeSelectedDisabled}
              title={
                selectedPoiName
                  ? `Анализ только для «${selectedPoiName}»`
                  : 'Выберите точку интереса на карте'
              }
              onClick={() => {
                closeMenu();
                onAnalyzeSelected();
              }}
            >
              <Zap size={14} className="shrink-0 opacity-70" aria-hidden />
              <span className="truncate">
                {analyzePending ? 'Расчёт…' : 'Анализ выбранной точки'}
              </span>
            </button>
          )}
          {showAnalyze && (canNetwork || canPads) && (
            <div
              className="my-1 border-t"
              style={{ borderColor: 'var(--border)' }}
              role="separator"
            />
          )}
          {canNetwork && (
            <button
              type="button"
              className={menuItemClass(drawMode === 'autoroad_network', networkDisabled)}
              disabled={networkDisabled}
              title={
                mapIn3d
                  ? 'Только в режиме 2D'
                  : 'Построить сеть автодорог между выбранными точками'
              }
              onClick={enterAutoroad}
            >
              <Route size={14} className="shrink-0" aria-hidden />
              <span className="truncate">Сеть автодорог</span>
            </button>
          )}
          {canPads && (
            <button
              type="button"
              className={menuItemClass(drawMode === 'pad_placement', padsDisabled)}
              disabled={padsDisabled}
              title={
                mapIn3d
                  ? 'Только в режиме 2D'
                  : 'Оптимизация размещения кустов по выбранным забоям'
              }
              onClick={enterPads}
            >
              <LayoutGrid size={14} className="shrink-0" aria-hidden />
              <span className="truncate">Оптимизация кустов</span>
            </button>
          )}
          {canWriteInfra && onLineProfileCompute && (
            <button
              type="button"
              className={menuItemClass(false, profileDisabled)}
              disabled={profileDisabled}
              title="Рассчитать высотный профиль линейных объектов по ЦМР"
              onClick={() => {
                closeMenu();
                onLineProfileCompute();
              }}
            >
              <LineChart size={14} className="shrink-0" aria-hidden />
              <span className="truncate">
                {lineProfileComputePending ? 'Расчёт…' : 'Рассчитать профиль'}
              </span>
            </button>
          )}
        </AnchoredMenu>
      </div>
    </div>
  );
}
