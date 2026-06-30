import {
  MousePointer2,
  Link2,
  Plus,
  Trash2,
  LayoutGrid,
  Save,
  RotateCcw,
} from 'lucide-react';
import { Button } from 'antd';
import type { FlowEditorTool, FluidKind } from '../../lib/flowSchematic';
import { ADD_NODE_TEMPLATES } from '../../lib/flowSchematic';
import { FlowSchematicEditPanel } from '../FlowSchematicEditPanel';
import { AppSelect } from '../AppSelect';
import { AppSelectFluid } from './AppSelectFluid';

function toolBtnType(active: boolean): 'primary' | 'text' {
  return active ? 'primary' : 'text';
}

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
        <Button
          size="small"
          block
          className="justify-start"
          type={toolBtnType(tool === 'select')}
          icon={<MousePointer2 size={16} />}
          title="Выбор и перемещение"
          onClick={() => onToolChange('select')}
        >
          Выбор
        </Button>
        <Button
          size="small"
          block
          className="justify-start"
          type={toolBtnType(tool === 'connect')}
          icon={<Link2 size={16} />}
          title="Соединить блоки"
          onClick={() => onToolChange('connect')}
        >
          Связь
        </Button>
        <Button
          size="small"
          block
          className="justify-start"
          type={toolBtnType(tool === 'add')}
          icon={<Plus size={16} />}
          title="Клик по полю — добавить блок"
          onClick={() => onToolChange('add')}
        >
          Блок
        </Button>
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
          <AppSelect
            variant="sm"
            fullWidth
            value={String(addTemplateIndex)}
            onChange={(v) => onAddTemplateIndexChange(Number(v))}
            options={ADD_NODE_TEMPLATES.map((t, i) => ({
              value: String(i),
              label: t.label,
            }))}
          />
        </div>
      )}

      <div className="flow-schematic-edit-panel-section">
        <span className="flow-schematic-edit-panel-label">Действия</span>
        <Button
          size="small"
          block
          className="justify-start"
          type="text"
          onClick={onEditSelectedLabel}
          title="Переименовать"
        >
          Подпись…
        </Button>
        <Button
          size="small"
          block
          className="justify-start"
          type="text"
          icon={<LayoutGrid size={16} />}
          onClick={onAutoLayout}
          title="Авто-раскладка"
        >
          Раскладка
        </Button>
        <Button
          size="small"
          block
          className="justify-start"
          type="text"
          icon={<Trash2 size={16} />}
          onClick={onDeleteSelected}
          title="Удалить выбранное"
        >
          Удалить
        </Button>
      </div>

      <div className="flow-schematic-edit-panel-section">
        <span className="flow-schematic-edit-panel-label">Схема</span>
        <Button
          size="small"
          block
          className="justify-start"
          type="primary"
          icon={<Save size={16} />}
          onClick={onSave}
          loading={saving}
        >
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
        <Button
          size="small"
          block
          className="justify-start"
          type="text"
          icon={<RotateCcw size={16} />}
          onClick={onReset}
          disabled={resetting || saving}
          loading={resetting}
          title={
            isCustom
              ? 'Удалить пользовательскую схему и пересчитать по POI и сети'
              : 'Пересчитать схему по текущим параметрам POI и сети'
          }
        >
          {resetting ? 'Пересчёт…' : isCustom ? 'Сброс' : 'Пересчитать'}
        </Button>
      </div>

      <p className="flow-schematic-edit-panel-hint">
        Перетаскивание по полю — перемещение схемы. Shift + перетаскивание — выделение рамкой.
        Двойной клик — переименование. Delete — удалить выделенное.
      </p>
    </FlowSchematicEditPanel>
  );
}
