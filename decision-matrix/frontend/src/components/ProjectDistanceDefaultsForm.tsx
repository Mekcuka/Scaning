import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { api, type DistanceDefaults } from '../lib/api';
import { KM_PER_PAD_FIELDS, MAX_TOTAL_LINE_FIELDS, THRESHOLD_FIELDS } from '../lib/poiParams';

interface ProjectDistanceDefaultsFormProps {
  projectId: string;
  readOnly?: boolean;
}

export function ProjectDistanceDefaultsForm({ projectId, readOnly }: ProjectDistanceDefaultsFormProps) {
  const qc = useQueryClient();
  const [values, setValues] = useState<DistanceDefaults | null>(null);
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['distanceDefaults', projectId],
    queryFn: () => api.getDistanceDefaults(projectId),
    enabled: !!projectId,
  });

  useEffect(() => {
    if (data) setValues(data);
  }, [data]);

  const saveMut = useMutation({
    mutationFn: (payload: Partial<DistanceDefaults>) => api.updateDistanceDefaults(projectId, payload),
    onSuccess: (row) => {
      setValues(row);
      qc.invalidateQueries({ queryKey: ['distanceDefaults', projectId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  if (isLoading || !values) {
    return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Загрузка параметров проекта…</p>;
  }

  const setNum = (key: keyof DistanceDefaults, raw: string) => {
    setValues((v) => (v ? { ...v, [key]: parseFloat(raw) || 0 } : v));
  };

  return (
    <div>
      <div className="card mb-4">
        <h2 className="font-semibold mb-3">Пороги до внешних объектов (4)</h2>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          Значения по умолчанию для новых POI (§1.3, FR-4.1.5)
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {THRESHOLD_FIELDS.map((f) => (
            <div key={f.key} className="form-group mb-0">
              <label>{f.label}</label>
              <input
                type="number"
                step={0.1}
                readOnly={readOnly}
                value={values[f.defaultKey]}
                onChange={(e) => setNum(f.defaultKey, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="card mb-4">
        <h2 className="font-semibold mb-3">Нормы линейной инфраструктуры (км/КП)</h2>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          §1.4 — копируются в POI при создании
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {KM_PER_PAD_FIELDS.map((f) => (
            <div key={f.key} className="form-group mb-0">
              <label>{f.label}, км/КП</label>
              <input
                type="number"
                step={0.1}
                readOnly={readOnly}
                value={values[f.defaultKey]}
                onChange={(e) => setNum(f.defaultKey, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="card mb-4">
        <h2 className="font-semibold mb-3">Макс. суммарная длина internal (км)</h2>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          §1.5 — лимиты для internal linear (FR-4.2.13)
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MAX_TOTAL_LINE_FIELDS.map((f) => (
            <div key={f.key} className="form-group mb-0">
              <label>{f.label}, км</label>
              <input
                type="number"
                step={0.1}
                readOnly={readOnly}
                value={values[f.defaultKey]}
                onChange={(e) => setNum(f.defaultKey, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      {!readOnly && (
        <button
          type="button"
          className="btn btn-primary"
          disabled={saveMut.isPending}
          onClick={() => saveMut.mutate(values)}
        >
          <Save size={16} /> {saved ? 'Сохранено!' : 'Сохранить параметры проекта'}
        </button>
      )}
    </div>
  );
}
