import {
  MousePointer2,
  Link2,
  Plus,
  Trash2,
  LayoutGrid,
  Save,
  RotateCcw,
} from 'lucide-react';
import type { FlowEditorTool, FluidKind } from '../../lib/flowSchematic';
import { ADD_NODE_TEMPLATES } from '../../lib/flowSchematic';
import { FlowSchematicEditPanel } from '../FlowSchematicEditPanel';
import { AppSelectFluid } from './AppSelectFluid';

export function FlowSchematicEditorPanel({
  tool,
  onToolChange,
  connectFluid,
  onConnectFluidChange,
  addTemplateIndex,
  onAddTemplateIndexChange,
  onEditSelectedLabel,
  onAutoLayout,
  onDeleteSelected,
  onSave,
  onReset,
  saving,
  resetting,
  isCustom,
}: {
  tool: FlowEditorTool;
  onToolChange: (tool: FlowEditorTool) => void;
  connectFluid: FluidKind;
  onConnectFluidChange: (fluid: FluidKind) => void;
  addTemplateIndex: number;
  onAddTemplateIndexChange: (index: number) => void;
  onEditSelectedLabel: () => void;
  onAutoLayout: () => void;
  onDeleteSelected: () => void;
  onSave: () => void;
  onReset: () => void;
  saving?: boolean;
  resetting?: boolean;
  isCustom: boolean;
}) {
  return (
    <FlowSchematicEditPanel
      panelId="editor"
      title="Редактирование"
      ariaLabel="Редактирование схемы"
    >
      <div className="flow-schematic-edit-panel-section">
        <span className="flow-schematic-edit-panel-label">Инструмент</span>
        <button
          type="button"
          className={`btn btn-sm w-full justify-start ${tool === 'select' ? 'btn-primary' : 'btn-ghost'}`}
          title="Выбор и перемещение"
          onClick={() => onToolChange('select')}
        >
          <MousePointer2 size={16} />
          Выбор
        </button>
        <button
          type="button"
          className={`btn btn-sm w-full justify-start ${tool === 'connect' ? 'btn-primary' : 'btn-ghost'}`}
          title="Соединить блоки"
          onClick={() => onToolChange('connect')}
        >
          <Link2 size={16} />
          Связь
        </button>
        <button
          type="button"
          className={`btn btn-sm w-full justify-start ${tool === 'add' ? 'btn-primary' : 'btn-ghost'}`}
          title="Клик по полю — добавить блок"
          onClick={() => onToolChange('add')}
        >
          <Plus size={16} />
          Блок
        </button>
      </div>

      {tool === 'connect' && (
        <div className="flow-schematic-edit-panel-section">
          <span className="flow-schematic-edit-panel-label">Флюид связи</span>
          <AppSelectFluid value={connectFluid} onChange={onConnectFluidChange} />
        </div>
      )}

      {tool === 'add' && (
        <div className="flow-schematic-edit-panel-section">
          <span className="flow-schematic-edit-panel-label">Тип блока</span>
          <select
            className="input text-sm py-1.5 px-2 w-full"
            value={addTemplateIndex}
            onChange={(e) => onAddTemplateIndexChange(Number(e.target.value))}
          >
            {ADD_NODE_TEMPLATES.map((t, i) => (
              <option key={`${t.kind}-${t.label}-${i}`} value={i}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flow-schematic-edit-panel-section">
        <span className="flow-schematic-edit-panel-label">Действия</span>
        <button
          type="button"
          className="btn btn-sm btn-ghost w-full justify-start"
          onClick={onEditSelectedLabel}
          title="Переименовать"
        >
          Подпись…
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost w-full justify-start"
          onClick={onAutoLayout}
          title="Авто-раскладка"
        >
          <LayoutGrid size={16} />
          Раскладка
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost w-full justify-start"
          onClick={onDeleteSelected}
          title="Удалить выбранное"
        >
          <Trash2 size={16} />
          Удалить
        </button>
      </div>

      <div className="flow-schematic-edit-panel-section">
        <span className="flow-schematic-edit-panel-label">Схема</span>
        <button
          type="button"
          className="btn btn-sm btn-primary w-full justify-start"
          onClick={onSave}
          disabled={saving}
        >
          <Save size={16} />
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost w-full justify-start"
          onClick={onReset}
          disabled={resetting || saving}
          title={
            isCustom
              ? 'Удалить пользовательскую схему и пересчитать по POI и сети'
              : 'Пересчитать схему по текущим параметрам POI и сети'
          }
        >
          <RotateCcw size={16} />
          {resetting ? 'Пересчёт…' : isCustom ? 'Сброс' : 'Пересчитать'}
        </button>
      </div>

      <p className="flow-schematic-edit-panel-hint">
        Перетаскивание по полю — перемещение схемы. Shift + перетаскивание — выделение рамкой.
        Двойной клик — переименование. Delete — удалить выделенное.
      </p>
    </FlowSchematicEditPanel>
  );
}
