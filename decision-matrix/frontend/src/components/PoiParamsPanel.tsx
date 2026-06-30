import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { Button } from 'antd';
import {
  defaultProjectsDataApi,
  defaultProjectsMapSettingsApi,
  defaultProjectsPoiWriteApi,
  type POI,
} from '../lib/api';
import { useAppStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';
import { AppSelect } from './AppSelect';
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
  flat?: boolean;
  hidePoiSelector?: boolean;
  /** Без внешней card — встраивается в родительскую панель (страница проекта). */
  embedded?: boolean;
  footer?: ReactNode;
  className?: string;
  onSaveSuccess?: (message: string) => void;
  onSaveError?: (message: string) => void;
}

export function PoiParamsPanel({
  projectId,
  poiId: controlledPoiId,
  onPoiChange,
  readOnly,
  sections,
  title = 'Параметры точки',
  showSave = true,
  flat = false,
  hidePoiSelector = false,
  embedded = false,
  footer,
  className = '',
  onSaveSuccess,
  onSaveError,
}: PoiParamsPanelProps) {
  const { canWriteProject } = usePermissions();
  const effectiveReadOnly = readOnly ?? !canWriteProject;
  const qc = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const [internalPoiId, setInternalPoiId] = useState<string | null>(null);
  const [form, setForm] = useState<PoiFormValues>(emptyPoiFormValues());

  const selectedPoiId = controlledPoiId ?? internalPoiId;

  const { data: pois = [] } = useQuery({
    queryKey: ['pois', projectId],
    queryFn: () => defaultProjectsDataApi.getPois(projectId!),
    enabled: !!projectId,
  });

  const { data: defaults } = useQuery({
    queryKey: ['distanceDefaults', projectId],
    queryFn: () => defaultProjectsMapSettingsApi.getDistanceDefaults(projectId!),
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
  }, [selectedPoi]);

  const saveMut = useMutation({
    mutationFn: (payload: ReturnType<typeof formValuesToPoiPayload>) =>
      defaultProjectsPoiWriteApi.updatePoi(projectId!, selectedPoi!.id, payload as Partial<POI>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pois', projectId] });
      const msg = 'Параметры точки сохранены';
      if (onSaveSuccess) onSaveSuccess(msg);
      else pushToast('success', msg);
    },
    onError: (err: Error) => {
      const msg = err instanceof Error ? err.message : 'Не удалось сохранить параметры';
      if (onSaveError) onSaveError(msg);
      else pushToast('error', msg);
    },
  });

  const shellClass = embedded ? `poi-params-panel--embedded ${className}` : `card ${className}`;

  if (!projectId) {
    return (
      <div className={shellClass} style={{ color: 'var(--text-muted)' }}>
        Выберите проект в шапке приложения.
      </div>
    );
  }

  if (pois.length === 0) {
    return (
      <div className={shellClass} style={{ color: 'var(--text-muted)' }}>
        Нет точек интереса. Добавьте POI на карте.
      </div>
    );
  }

  const handlePoiSelect = (id: string) => {
    if (onPoiChange) onPoiChange(id);
    else setInternalPoiId(id);
  };

  return (
    <div className={shellClass}>
      {!embedded && (title || (!hidePoiSelector && pois.length > 1)) && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          {title ? <h2 className="font-semibold text-sm">{title}</h2> : <span />}
          {!hidePoiSelector && pois.length > 1 && (
            <AppSelect
              variant="sm"
              ariaLabel="Точка интереса"
              value={selectedPoi?.id ?? ''}
              onChange={handlePoiSelect}
              options={pois.map((p) => ({ value: p.id, label: p.name }))}
            />
          )}
        </div>
      )}

      <PoiParamsForm
        value={form}
        onChange={setForm}
        defaults={defaults}
        readOnly={effectiveReadOnly}
        sections={sections}
        flat={flat}
      />

      {(showSave && !effectiveReadOnly && selectedPoi) || footer ? (
        <div
          className={
            embedded
              ? 'poi-params-panel__footer'
              : 'mt-3 flex flex-wrap items-center justify-between gap-2'
          }
        >
          {footer ? <div className="project-detail-params-footer">{footer}</div> : <span />}
          {showSave && !effectiveReadOnly && selectedPoi && (
            <Button
              type="primary"
              size="small"
              className={embedded ? undefined : 'ml-auto'}
              disabled={saveMut.isPending}
              loading={saveMut.isPending}
              icon={<Save size={14} />}
              onClick={() => saveMut.mutate(formValuesToPoiPayload(form))}
            >
              {saveMut.isPending ? 'Сохранение…' : 'Сохранить POI'}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
