import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { api, type DistanceDefaults } from '../lib/api';
import { useAppStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';
import { DISTANCE_PARAMETER_GROUPS } from '../lib/parameterCatalog';
import { DeferredNumberInput } from './DeferredNumberInput';

interface ProjectDistanceDefaultsFormProps {
  projectId: string;
  readOnly?: boolean;
  /** Одна карточка, плотная сетка (страница параметров POI). */
  compact?: boolean;
}

export function ProjectDistanceDefaultsForm({
  projectId,
  readOnly,
  compact = false,
}: ProjectDistanceDefaultsFormProps) {
  const { canWriteProject } = usePermissions();
  const effectiveReadOnly = readOnly ?? !canWriteProject;
  const qc = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const [values, setValues] = useState<DistanceDefaults | null>(null);

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
      pushToast('success', 'Параметры расстояний сохранены');
    },
    onError: (err: Error) => {
      pushToast('error', err.message || 'Не удалось сохранить параметры');
    },
  });

  if (isLoading || !values) {
    return (
      <p className="text-sm py-2" style={{ color: 'var(--text-muted)' }}>
        Загрузка параметров…
      </p>
    );
  }

  const setField = (key: keyof DistanceDefaults, raw: number | string) => {
    setValues((v) => (v ? { ...v, [key]: typeof raw === 'number' ? raw : parseFloat(String(raw)) || 0 } : v));
  };

  const body = (
    <>
      {DISTANCE_PARAMETER_GROUPS.map((group) => (
        <div key={group.id} className={compact ? 'rates-distance-block' : 'card mb-4'}>
          <h3 className={compact ? 'rates-distance-title' : 'font-semibold mb-3'}>
            {group.label}
            <span className="text-xs font-normal ml-2" style={{ color: 'var(--text-muted)' }}>
              ({group.unitLabel})
            </span>
          </h3>
          <div className={compact ? 'rates-distance-grid' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}>
            {group.rows.map((row) => (
              <label key={row.id} className={compact ? 'rates-field' : 'form-group mb-0'}>
                <span className={compact ? 'rates-field-label' : undefined}>{row.label}</span>
                <DeferredNumberInput
                  readOnly={effectiveReadOnly}
                  className={compact ? 'rates-input' : undefined}
                  value={values[row.distanceKey]}
                  min={0}
                  onCommit={(v) => setField(row.distanceKey, v)}
                />
              </label>
            ))}
          </div>
        </div>
      ))}
    </>
  );

  if (compact) {
    return (
      <div className="card card--flush rates-distance-card">
        <div className="card-header">
          <div>
            <h2 className="!text-sm">Расстояние</h2>
            <p className="text-xs mt-0.5 mb-0" style={{ color: 'var(--text-muted)' }}>
              Дефолты проекта для POI и анализа
            </p>
          </div>
        </div>
        <div className="rates-distance-body">{body}</div>
        {!effectiveReadOnly && (
          <div className="rates-distance-footer">
            <button
              type="button"
              className="btn btn-primary btn-sm w-full"
              disabled={saveMut.isPending}
              onClick={() => saveMut.mutate(values)}
            >
              <Save size={14} className="inline mr-1" />
              {saveMut.isPending ? 'Сохранение…' : 'Сохранить расстояния'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {body}
      {!effectiveReadOnly && (
        <button
          type="button"
          className="btn btn-primary"
          disabled={saveMut.isPending}
          onClick={() => saveMut.mutate(values)}
        >
          <Save size={16} /> {saveMut.isPending ? 'Сохранение…' : 'Сохранить параметры проекта'}
        </button>
      )}
    </div>
  );
}
