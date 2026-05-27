import { useState } from 'react';
import { Eye, EyeOff, GripVertical, Plus, Trash2 } from 'lucide-react';
import type { InfraLayer } from '../lib/api';

interface LayerPanelProps {
  layers: InfraLayer[];
  subtypeFilter: Record<string, boolean>;
  onSubtypeFilterChange: (subtype: string, visible: boolean) => void;
  onCreate: (name: string) => void;
  onUpdate: (layerId: string, data: Partial<InfraLayer>) => void;
  onDelete: (layerId: string) => void;
  onReorder: (orderedIds: string[]) => void;
}

export function LayerPanel({
  layers,
  subtypeFilter,
  onSubtypeFilterChange,
  onCreate,
  onUpdate,
  onDelete,
  onReorder,
}: LayerPanelProps) {
  const [newName, setNewName] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const sorted = [...layers].sort((a, b) => a.sort_order - b.sort_order);

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ids = sorted.map((l) => l.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    onReorder(ids);
    setDragId(null);
  };

  return (
    <div className="flex flex-col gap-3 p-3 text-sm">
      <div className="font-medium">Слои</div>
      <div className="flex gap-2">
        <input
          className="input flex-1 text-sm"
          placeholder="Новый слой"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-secondary p-2"
          title="Создать слой"
          onClick={() => {
            if (newName.trim()) {
              onCreate(newName.trim());
              setNewName('');
            }
          }}
        >
          <Plus size={16} />
        </button>
      </div>
      <ul className="flex flex-col gap-2 max-h-48 overflow-auto">
        {sorted.map((layer) => (
          <li
            key={layer.id}
            draggable
            onDragStart={() => setDragId(layer.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(layer.id)}
            className={`border rounded-lg p-2 ${dragId === layer.id ? 'opacity-50' : ''}`}
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-1">
              <GripVertical size={14} className="opacity-40 shrink-0 cursor-grab" />
              <input
                className="input flex-1 text-xs py-1"
                value={layer.name}
                onChange={(e) => onUpdate(layer.id, { name: e.target.value })}
              />
              <button
                type="button"
                className="p-1"
                onClick={() => onUpdate(layer.id, { is_visible: !layer.is_visible })}
              >
                {layer.is_visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <button type="button" className="p-1 text-red-600" onClick={() => onDelete(layer.id)}>
                <Trash2 size={14} />
              </button>
            </div>
            <label className="text-xs flex items-center gap-2 mt-2">
              Прозрачность
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={layer.opacity}
                onChange={(e) => onUpdate(layer.id, { opacity: parseFloat(e.target.value) })}
                className="flex-1"
              />
              <span>{Math.round(layer.opacity * 100)}%</span>
            </label>
            <label className="text-xs flex items-center gap-2 mt-1">
              Цвет
              <input
                type="color"
                value={(layer.style_config?.color as string) || '#78909c'}
                onChange={(e) =>
                  onUpdate(layer.id, {
                    style_config: { ...layer.style_config, color: e.target.value },
                  })
                }
                className="h-6 w-10"
              />
            </label>
          </li>
        ))}
      </ul>
      <div className="font-medium text-xs mt-1">Фильтр подтипов</div>
      <div className="flex flex-wrap gap-2">
        {Object.entries(subtypeFilter).map(([st, on]) => (
          <label key={st} className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={on} onChange={(e) => onSubtypeFilterChange(st, e.target.checked)} />
            {st}
          </label>
        ))}
      </div>
    </div>
  );
}
