import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ProjectLink } from '../components/ProjectLink';
import { MapPin, Search } from 'lucide-react';
import { Button, Card, Input } from 'antd';
import { defaultMapMutationsApi, SUBTYPE_LABELS, type InfraObject } from '../lib/api';
import {
  capacityUnitLabel,
  defaultCapacityUnitForSubtype,
  effectiveThroughputCapacity,
  mergeThroughputCapacity,
  pointShowsThroughputCapacity,
} from '../lib/infraCapacity';
import { useAppStore } from '../store';
import { useActiveProject } from '../hooks/useActiveProject';
import { useProjectInfraObjects } from '../hooks/useProjectData';
import { usePermissions } from '../hooks/usePermissions';
import { queryKeys } from '../lib/queryKeys';
import type { ColumnsType } from 'antd/es/table';
import { DeferredNumberInput } from '../components/DeferredNumberInput';
import { AppDataTable } from '../components/AppDataTable';
import { capacityTableExportColumns } from '../lib/tableExcelExportData';

function capacityDisplayValue(obj: InfraObject): number | '' {
  const { value } = effectiveThroughputCapacity(obj.subtype, obj.properties);
  return value != null ? value : '';
}

export function ParametersPage() {
  const { canWriteProject } = usePermissions();
  const { projectId } = useActiveProject();
  const pushToast = useAppStore((s) => s.pushToast);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: infraObjects = [], isLoading } = useProjectInfraObjects(projectId, {
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
      return defaultMapMutationsApi.updateInfraObject(projectId!, object.id, {
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
      if (projectId) queryClient.invalidateQueries({ queryKey: queryKeys.infra(projectId) });
    },
    onSettled: () => {
      setSavingId(null);
    },
  });

  const columns = useMemo<ColumnsType<InfraObject>>(
    () => [
      {
        title: 'Объект',
        dataIndex: 'name',
        key: 'name',
        className: 'parameters-table__name',
        onCell: () => ({ scope: 'row' as const }),
      },
      {
        title: 'Подтип',
        key: 'subtype',
        render: (_, obj) => SUBTYPE_LABELS[obj.subtype] || obj.subtype,
      },
      {
        title: 'Ед. изм.',
        key: 'unit',
        className: 'parameters-table__unit',
        render: (_, obj) => {
          const effective = effectiveThroughputCapacity(obj.subtype, obj.properties);
          return capacityUnitLabel(effective.unit);
        },
      },
      {
        title: 'Пропускная способность',
        key: 'capacity',
        render: (_, obj) => {
          const effective = effectiveThroughputCapacity(obj.subtype, obj.properties);
          const isSaving = savingId === obj.id;
          return (
            <DeferredNumberInput
              allowEmpty
              min={0}
              className="parameters-table__input"
              placeholder="Не задана"
              title={
                effective.isStored
                  ? undefined
                  : 'Норматив для подтипа (задаётся при создании объекта на карте)'
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
          );
        },
      },
    ],
    [canWriteProject, saveMut, savingId],
  );

  if (!projectId) {
    return (
      <div className="parameters-page">
        <Card size="small" className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Выберите проект в шапке приложения.
        </Card>
      </div>
    );
  }

  return (
    <div className="parameters-page">
      <div className="parameters-page-top">
        <p className="parameters-page__hint" style={{ color: 'var(--text-muted)' }}>
          {canWriteProject ? 'Сохранение при выходе из поля или Enter' : 'Просмотр пропускной способности объектов'}
        </p>
        <ProjectLink to="/map">
          <Button size="small" className="shrink-0" icon={<MapPin size={14} />}>
            Открыть карту
          </Button>
        </ProjectLink>
      </div>

      <Card className="card--flush parameters-card" styles={{ body: { padding: 0 } }}>
        <div className="parameters-toolbar">
          <label className="parameters-search">
            <Search size={16} aria-hidden />
            <Input
              type="search"
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
            <ProjectLink to="/map">карте</ProjectLink>.
          </p>
        ) : (
          <AppDataTable
            className="parameters-table"
            rowKey="id"
            loading={isLoading}
            columns={columns}
            dataSource={filteredObjects}
            excelExport={{
              filename: 'parametry-propusknaya-sposobnost.xlsx',
              sheetName: 'Пропускная способность',
              columns: capacityTableExportColumns(),
              rows: filteredObjects,
              disabled: filteredObjects.length === 0,
            }}
          />
        )}
      </Card>
    </div>
  );
}
