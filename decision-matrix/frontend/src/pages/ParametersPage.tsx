import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MapPin, Search } from 'lucide-react';
import { api, SUBTYPE_LABELS, type InfraObject } from '../lib/api';
import {
  capacityUnitLabel,
  defaultCapacityUnitForSubtype,
  defaultThroughputCapacityForSubtype,
  effectiveThroughputCapacity,
  mergeThroughputCapacity,
  pointShowsThroughputCapacity,
  readThroughputCapacity,
} from '../lib/infraCapacity';
import { useAppStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';
import { DeferredNumberInput } from '../components/DeferredNumberInput';
import {
  TableExcelExportBodyCell,
  TableExcelExportButton,
} from '../components/TableExcelExportButton';
import { capacityTableExportColumns } from '../lib/tableExcelExportData';

function capacityDisplayValue(obj: InfraObject): number | '' {
  const { value } = effectiveThroughputCapacity(obj.subtype, obj.properties);
  return value != null ? value : '';
}

export function ParametersPage() {
  const { canWriteProject } = usePermissions();
  const projectId = useAppStore((s) => s.currentProjectId);
  const pushToast = useAppStore((s) => s.pushToast);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const defaultsAppliedRef = useRef(false);

  const { data: infraObjects = [], isLoading } = useQuery({
    queryKey: ['infra', projectId],
    queryFn: () => api.getInfraObjects(projectId!),
    enabled: !!projectId,
    refetchOnMount: 'always',
  });

  const capacityObjects = useMemo(
    () =>
      infraObjects
        .filter((o) => pointShowsThroughputCapacity(o.subtype))
        .sort((a, b) => {
          const subtypeCmp = (SUBTYPE_LABELS[a.subtype] || a.subtype).localeCompare(
            SUBTYPE_LABELS[b.subtype] || b.subtype,
            'ru'
          );
          if (subtypeCmp !== 0) return subtypeCmp;
          return a.name.localeCompare(b.name, 'ru');
        }),
    [infraObjects]
  );

  const filteredObjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return capacityObjects;
    return capacityObjects.filter((o) => {
      const subtypeLabel = (SUBTYPE_LABELS[o.subtype] || o.subtype).toLowerCase();
      return o.name.toLowerCase().includes(q) || subtypeLabel.includes(q);
    });
  }, [capacityObjects, search]);

  useEffect(() => {
    defaultsAppliedRef.current = false;
  }, [projectId]);

  useEffect(() => {
    if (!projectId || isLoading || defaultsAppliedRef.current || !canWriteProject) return;

    const toFill = capacityObjects.filter((o) => {
      if (readThroughputCapacity(o.properties).value != null) return false;
      return defaultThroughputCapacityForSubtype(o.subtype) != null;
    });
    if (toFill.length === 0) {
      defaultsAppliedRef.current = true;
      return;
    }

    defaultsAppliedRef.current = true;
    void (async () => {
      try {
        for (const obj of toFill) {
          const def = defaultThroughputCapacityForSubtype(obj.subtype)!;
          await api.updateInfraObject(projectId, obj.id, {
            properties: mergeThroughputCapacity(obj.properties, def.value, def.unit),
          });
        }
        await queryClient.invalidateQueries({ queryKey: ['infra', projectId] });
        await queryClient.invalidateQueries({ queryKey: ['economic-flow-schematic', projectId] });
        pushToast('success', `Стандартные значения заданы для ${toFill.length} объектов`);
      } catch (err) {
        defaultsAppliedRef.current = false;
        pushToast('error', err instanceof Error ? err.message : 'Не удалось задать стандартные значения');
      }
    })();
  }, [projectId, isLoading, capacityObjects, queryClient, pushToast, canWriteProject]);

  const saveMut = useMutation({
    mutationFn: async ({
      object,
      value,
    }: {
      object: InfraObject;
      value: number | '';
    }) => {
      const unit = defaultCapacityUnitForSubtype(object.subtype);
      const numVal = value === '' ? null : value;
      return api.updateInfraObject(projectId!, object.id, {
        properties: mergeThroughputCapacity(object.properties, numVal, unit),
      });
    },
    onMutate: ({ object, value }) => {
      setSavingId(object.id);
      const unit = defaultCapacityUnitForSubtype(object.subtype);
      const numVal = value === '' ? null : value;
      queryClient.setQueryData<InfraObject[]>(['infra', projectId], (prev) =>
        (prev ?? []).map((o) =>
          o.id === object.id
            ? { ...o, properties: mergeThroughputCapacity(o.properties, numVal, unit) }
            : o
        )
      );
    },
    onSuccess: () => {
      pushToast('success', 'Пропускная способность сохранена');
      queryClient.invalidateQueries({ queryKey: ['economic-flow-schematic', projectId] });
    },
    onError: (err: Error) => {
      pushToast('error', err.message || 'Не удалось сохранить');
      queryClient.invalidateQueries({ queryKey: ['infra', projectId] });
    },
    onSettled: () => {
      setSavingId(null);
    },
  });

  if (!projectId) {
    return (
      <div className="parameters-page">
        <div className="card text-sm" style={{ color: 'var(--text-muted)' }}>
          Выберите проект в шапке приложения.
        </div>
      </div>
    );
  }

  return (
    <div className="parameters-page">
      <div className="parameters-page-top">
        <p className="parameters-page__hint" style={{ color: 'var(--text-muted)' }}>
          {canWriteProject ? 'Сохранение при выходе из поля или Enter' : 'Просмотр пропускной способности объектов'}
        </p>
        <Link to="/map" className="btn btn-secondary btn-sm shrink-0">
          <MapPin size={14} className="inline mr-1" />
          Открыть карту
        </Link>
      </div>

      <div className="card card--flush parameters-card">
        <div className="parameters-toolbar">
          <label className="parameters-search">
            <Search size={16} aria-hidden />
            <input
              type="search"
              className="input"
              placeholder="Поиск по названию или подтипу…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Поиск объектов"
            />
          </label>
          <span className="parameters-count" style={{ color: 'var(--text-muted)' }}>
            {isLoading ? 'Загрузка…' : `${filteredObjects.length} из ${capacityObjects.length}`}
          </span>
        </div>

        {capacityObjects.length === 0 && !isLoading ? (
          <p className="parameters-empty" style={{ color: 'var(--text-muted)' }}>
            Нет объектов с полем пропускной способности. Импортируйте данные Искра или добавьте объекты на{' '}
            <Link to="/map">карте</Link>.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table parameters-table">
              <thead>
                <tr>
                  <th scope="col">Объект</th>
                  <th scope="col">Подтип</th>
                  <th scope="col">Ед. изм.</th>
                  <th scope="col">Пропускная способность</th>
                  <th scope="col" className="table-excel-export-th">
                    <TableExcelExportButton
                      filename="parametry-propusknaya-sposobnost.xlsx"
                      sheetName="Пропускная способность"
                      columns={capacityTableExportColumns()}
                      rows={filteredObjects}
                      disabled={filteredObjects.length === 0}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredObjects.map((obj) => {
                  const effective = effectiveThroughputCapacity(obj.subtype, obj.properties);
                  const unitLabel = capacityUnitLabel(effective.unit);
                  const isSaving = savingId === obj.id;
                  return (
                    <tr key={obj.id}>
                      <th scope="row" className="parameters-table__name">
                        {obj.name}
                      </th>
                      <td>{SUBTYPE_LABELS[obj.subtype] || obj.subtype}</td>
                      <td className="parameters-table__unit">{unitLabel}</td>
                      <td>
                        <DeferredNumberInput
                          allowEmpty
                          min={0}
                          className="input parameters-table__input"
                          placeholder="Не задана"
                          title={
                            effective.isStored
                              ? undefined
                              : 'Стандартное значение для подтипа (сохраняется автоматически)'
                          }
                          value={capacityDisplayValue(obj)}
                          readOnly={!canWriteProject}
                          disabled={isSaving || !canWriteProject}
                          onCommit={(v) => {
                            saveMut.mutate({
                              object: obj,
                              value: v === '' ? '' : typeof v === 'number' ? v : Number(v),
                            });
                          }}
                        />
                      </td>
                      <TableExcelExportBodyCell />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
