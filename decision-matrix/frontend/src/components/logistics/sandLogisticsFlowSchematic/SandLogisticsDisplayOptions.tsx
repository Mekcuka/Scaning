import { LayoutGrid } from 'lucide-react';
import { AppSelect } from '../../AppSelect';
import {
  SAND_LOGISTICS_EDGE_LABEL_MODE_OPTIONS,
  SAND_LOGISTICS_LINE_STYLE_OPTIONS,
  SAND_LOGISTICS_NODE_FILTER_OPTIONS,
  type SandLogisticsEdgeLabelMode,
  type SandLogisticsLineStyle,
  type SandLogisticsNodeFilterMode,
} from '../../../lib/sandLogisticsFlow';

type SandLogisticsDisplayOptionsProps = {
  lineStyle: SandLogisticsLineStyle;
  edgeLabelMode: SandLogisticsEdgeLabelMode;
  nodeFilter: SandLogisticsNodeFilterMode;
  showPlannedRoutes: boolean;
  groupByEntryYear: boolean;
  onLineStyleChange: (value: string) => void;
  onEdgeLabelModeChange: (value: string) => void;
  onNodeFilterChange: (value: string) => void;
  onShowPlannedRoutesChange: (value: boolean) => void;
  onGroupByEntryYearChange: (value: boolean) => void;
  onResetLayout: () => void;
};

export function SandLogisticsDisplayOptions({
  lineStyle,
  edgeLabelMode,
  nodeFilter,
  showPlannedRoutes,
  groupByEntryYear,
  onLineStyleChange,
  onEdgeLabelModeChange,
  onNodeFilterChange,
  onShowPlannedRoutesChange,
  onGroupByEntryYearChange,
  onResetLayout,
}: SandLogisticsDisplayOptionsProps) {
  return (
    <>
      <div className="flow-schematic-edit-panel-group">
        <span className="flow-schematic-edit-panel-label">Отображение</span>
        <AppSelect
          variant="sm"
          fullWidth
          ariaLabel="Фильтр объектов на схеме"
          options={SAND_LOGISTICS_NODE_FILTER_OPTIONS}
          value={nodeFilter}
          onChange={onNodeFilterChange}
        />
        <AppSelect
          variant="sm"
          fullWidth
          ariaLabel="Подписи объёма на схеме"
          options={SAND_LOGISTICS_EDGE_LABEL_MODE_OPTIONS}
          value={edgeLabelMode}
          onChange={onEdgeLabelModeChange}
        />
        <label className="flow-schematic-edit-panel-check">
          <input
            type="checkbox"
            checked={showPlannedRoutes}
            onChange={(e) => onShowPlannedRoutesChange(e.target.checked)}
          />
          <span>Плановые маршруты</span>
        </label>
        <label className="flow-schematic-edit-panel-check">
          <input
            type="checkbox"
            checked={groupByEntryYear}
            onChange={(e) => onGroupByEntryYearChange(e.target.checked)}
          />
          <span>Группировка по году ввода</span>
        </label>
      </div>

      <div className="flow-schematic-edit-panel-group">
        <span className="flow-schematic-edit-panel-label">Линии</span>
        <AppSelect
          variant="sm"
          fullWidth
          ariaLabel="Форма линий на схеме"
          options={SAND_LOGISTICS_LINE_STYLE_OPTIONS}
          value={lineStyle}
          onChange={onLineStyleChange}
        />
      </div>

      <div className="flow-schematic-edit-panel-group">
        <button
          type="button"
          className="btn btn-sm btn-secondary w-full justify-center gap-2"
          onClick={onResetLayout}
          title="Вернуть раскладку по координатам карты"
        >
          <LayoutGrid size={16} aria-hidden />
          По карте
        </button>
      </div>
    </>
  );
}
