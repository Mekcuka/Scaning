import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { api, type POI } from '../lib/api';
import { PoiParamsForm } from './PoiParamsForm';
import {
  emptyPoiFormValues,
  formValuesToPoiPayload,
  poiToFormValues,
  type PoiFormValues,
  type PoiSectionId,
} from '../lib/poiParams';

interface PoiParamsPanelProps {
  projectId: string | null;
  poiId?: string | null;
  onPoiChange?: (poiId: string) => void;
  readOnly?: boolean;
  sections?: PoiSectionId[];
  title?: string;
  showSave?: boolean;
  className?: string;
}

export function PoiParamsPanel({
  projectId,
  poiId: controlledPoiId,
  onPoiChange,
  readOnly,
  sections,
  title = 'Параметры точки интереса (POI)',
  showSave = true,
  className = '',
}: PoiParamsPanelProps) {
  const qc = useQueryClient();
  const [internalPoiId, setInternalPoiId] = useState<string | null>(null);
  const [form, setForm] = useState<PoiFormValues>(emptyPoiFormValues());
  const [saved, setSaved] = useState(false);

  const selectedPoiId = controlledPoiId ?? internalPoiId;

  const { data: pois = [] } = useQuery({
    queryKey: ['pois', projectId],
    queryFn: () => api.getPois(projectId!),
    enabled: !!projectId,
  });

  const { data: defaults } = useQuery({
    queryKey: ['distanceDefaults', projectId],
    queryFn: () => api.getDistanceDefaults(projectId!),
    enabled: !!projectId,
    retry: false,
  });

  const selectedPoi = pois.find((p) => p.id === selectedPoiId) ?? pois[0] ?? null;

  useEffect(() => {
    if (controlledPoiId == null && pois[0] && !internalPoiId) {
      setInternalPoiId(pois[0].id);
    }
  }, [controlledPoiId, pois, internalPoiId]);

  useEffect(() => {
    if (selectedPoi) setForm(poiToFormValues(selectedPoi));
  }, [selectedPoi?.id]);

  const saveMut = useMutation({
    mutationFn: (payload: ReturnType<typeof formValuesToPoiPayload>) =>
      api.updatePoi(projectId!, selectedPoi!.id, payload as Partial<POI>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pois', projectId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  if (!projectId) {
    return (
      <div className={`card ${className}`} style={{ color: 'var(--text-muted)' }}>
        Выберите проект в шапке приложения.
      </div>
    );
  }

  if (pois.length === 0) {
    return (
      <div className={`card ${className}`} style={{ color: 'var(--text-muted)' }}>
        Нет точек интереса. Добавьте POI на карте.
      </div>
    );
  }

  const handlePoiSelect = (id: string) => {
    if (onPoiChange) onPoiChange(id);
    else setInternalPoiId(id);
  };

  return (
    <div className={`card ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="font-semibold text-sm">{title}</h2>
        {pois.length > 1 && (
          <select
            className="text-sm px-2 py-1 rounded-lg border max-w-[200px]"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            value={selectedPoi?.id ?? ''}
            onChange={(e) => handlePoiSelect(e.target.value)}
          >
            {pois.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <PoiParamsForm
        value={form}
        onChange={setForm}
        defaults={defaults}
        readOnly={readOnly}
        sections={sections}
      />

      {showSave && !readOnly && selectedPoi && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={saveMut.isPending}
            onClick={() => saveMut.mutate(formValuesToPoiPayload(form))}
          >
            <Save size={14} /> {saved ? 'Сохранено!' : 'Сохранить POI'}
          </button>
        </div>
      )}
    </div>
  );
}
