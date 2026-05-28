import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { api, type DistanceDefaults } from '../lib/api';
import { useAppStore } from '../store';
import { KM_PER_PAD_FIELDS, MAX_TOTAL_LINE_FIELDS, THRESHOLD_FIELDS } from '../lib/poiParams';

interface ProjectDistanceDefaultsFormProps {
  projectId: string;
  readOnly?: boolean;
  /** Одна карточка, плотная сетка (страница ставок). */
  compact?: boolean;
}

export function ProjectDistanceDefaultsForm({
  projectId,
  readOnly,
  compact = false,
}: ProjectDistanceDefaultsFormProps) {
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

  const setNum = (key: keyof DistanceDefaults, raw: string) => {
    setValues((v) => (v ? { ...v, [key]: parseFloat(raw) || 0 } : v));
  };

  const renderFields = (
    title: string,
    hint: string,
    fields: { key: string; label: string; defaultKey: keyof DistanceDefaults }[],
    suffix?: string,
  ) => (
    <div className={compact ? 'rates-distance-block' : 'card mb-4'}>
      <h3 className={compact ? 'rates-distance-title' : 'font-semibold mb-3'}>{title}</h3>
      {!compact && (
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          {hint}
        </p>
      )}
      <div className={compact ? 'rates-distance-grid' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}>
        {fields.map((f) => (
          <label key={f.key} className={compact ? 'rates-field' : 'form-group mb-0'}>
            <span className={compact ? 'rates-field-label' : undefined}>
              {f.label}
              {suffix ? `, ${suffix}` : ''}
            </span>
            <input
              type="number"
              step={0.1}
              readOnly={readOnly}
              className={compact ? 'rates-input' : undefined}
              value={values[f.defaultKey]}
              onChange={(e) => setNum(f.defaultKey, e.target.value)}
            />
          </label>
        ))}
      </div>
    </div>
  );

  if (compact) {
    return (
      <div className="card card--flush rates-distance-card">
        <div className="card-header">
          <div>
            <h2 className="!text-sm">Расстояния проекта</h2>
            <p className="text-xs mt-0.5 mb-0" style={{ color: 'var(--text-muted)' }}>
              FR-4.1.2, FR-4.1.5 · дефолты для POI
            </p>
          </div>
        </div>
        <div className="rates-distance-body">
          {renderFields('Пороги, км', '§1.3', THRESHOLD_FIELDS)}
          {renderFields('Нормы, км/КП', '§1.4', KM_PER_PAD_FIELDS)}
          {renderFields('Макс. internal, км', '§1.5', MAX_TOTAL_LINE_FIELDS)}
        </div>
        {!readOnly && (
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
      {renderFields('Пороги до внешних объектов (4)', 'Значения по умолчанию для новых POI (§1.3, FR-4.1.5)', THRESHOLD_FIELDS)}
      {renderFields('Нормы линейной инфраструктуры (км/КП)', '§1.4 — копируются в POI при создании', KM_PER_PAD_FIELDS, 'км/КП')}
      {renderFields('Макс. суммарная длина internal (км)', '§1.5 — лимиты для internal linear (FR-4.2.13)', MAX_TOTAL_LINE_FIELDS, 'км')}

      {!readOnly && (
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
