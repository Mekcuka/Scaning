import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ProjectLink } from '../components/ProjectLink';
import { MapPin, Search } from 'lucide-react';
import { Button, Card, Input } from 'antd';
import { defaultMapMutationsApi, SUBTYPE_LABELS, type InfraObject } from '../lib/api';
import {
  effectiveSandDemandForObject,
  infraObjectShowsSandDemand,
  mergeSandVolumeForSave,
  readSandDemandM3,
  readSandVolumeInputMode,
  sandDemandPlanTotalM3,
} from '../lib/infraSandVolumes';
import { findSandLogisticsConsumer } from '../lib/sandLogisticsHaulLegs';
import { useAppStore } from '../store';
import { useActiveProject } from '../hooks/useActiveProject';
import { useProjectInfraObjects } from '../hooks/useProjectData';
import { usePermissions } from '../hooks/usePermissions';
import { queryKeys } from '../lib/queryKeys';
import { useProjectSandLogistics } from '../hooks/useProjectSandLogistics';
import type { ColumnsType } from 'antd/es/table';
import { DeferredNumberInput } from '../components/DeferredNumberInput';
import { AppDataTable } from '../components/AppDataTable';
import { renderSandHaulLegCell } from '../components/logistics/SandHaulLegParameterCells';
import { sandDemandTableExportColumns } from '../lib/tableExcelExportData';

function fmtM3(v: number | null | undefined): string {
  if (v == null || v <= 0) return '—';
  return v.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
}

function sandDemandDisplayValue(obj: InfraObject): number | '' {
  const v = readSandDemandM3(obj.properties);
  return v > 0 ? v : '';
}

export function SandParametersPage() {
  const { canWriteProject } = usePermissions();
  const { projectId } = useActiveProject();
  const pushToast = useAppStore((s) => s.pushToast);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: infraObjects = [], isLoading } = useProjectInfraObjects(projectId, {
    refetchOnMount: 'always',
  });

  const { data: sandLogistics } = useProjectSandLogistics(projectId);

  const sandObjects = useMemo(
    () =>
      infraObjects
        .filter((o) => infraObjectShowsSandDemand(o))
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
    if (!q) return sandObjects;
    return sandObjects.filter((o) => {
      const subtypeLabel = (SUBTYPE_LABELS[o.subtype] || o.subtype).toLowerCase();
      return o.name.toLowerCase().includes(q) || subtypeLabel.includes(q);
    });
  }, [sandObjects, search]);

  const saveMut = useMutation({
    mutationFn: async ({
      object,
      value,
    }: {
      object: InfraObject;
      value: number | '';
    }) => {
      const numVal = value === '' ? null : value;
      return defaultMapMutationsApi.updateInfraObject(projectId!, object.id, {
        properties: mergeSandVolumeForSave(object.properties, 'single', numVal, {}),
      });
    },
    onMutate: ({ object, value }) => {
      setSavingId(object.id);
      const numVal = value === '' ? null : value;
      queryClient.setQueryData<InfraObject[]>(['infra', projectId], (prev) =>
        (prev ?? []).map((o) =>
          o.id === object.id
            ? { ...o, properties: mergeSandVolumeForSave(o.properties, 'single', numVal, {}) }
            : o
        )
      );
    },
    onSuccess: () => {
      pushToast('success', 'Объём песка сохранён');
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
        title: 'Объём песка (спрос), м³',
        key: 'demand',
        render: (_, obj) => {
          const isSaving = savingId === obj.id;
          if (readSandVolumeInputMode(obj.properties) === 'yearly') {
            return (
              <span
                className="text-sm text-[var(--text-muted)]"
                title="Редактирование — карточка объекта на карте, вкладка Логистика"
              >
                План по годам
              </span>
            );
          }
          return (
            <DeferredNumberInput
              allowEmpty
              min={0}
              className="parameters-table__input"
              placeholder="Не задан"
              value={sandDemandDisplayValue(obj)}
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
      {
        title: 'План Σ, м³',
        key: 'planTotal',
        className: 'tabular-nums text-[var(--text-muted)]',
        render: (_, obj) => {
          const planTotal = sandDemandPlanTotalM3(obj.properties);
          if (readSandVolumeInputMode(obj.properties) === 'yearly') {
            return (
              <span title="План по годам (редактирование — карточка на карте)">
                {fmtM3(planTotal)} · по годам
              </span>
            );
          }
          return '—';
        },
      },
      {
        title: 'Спрос на дату',
        key: 'demandOnDate',
        className: 'tabular-nums',
        render: (_, obj) => {
          const calcRow = sandLogistics ? findSandLogisticsConsumer(sandLogistics, obj.id) : null;
          const effectiveOnDate =
            calcRow?.demand_m3 ??
            (sandLogistics?.as_of ? effectiveSandDemandForObject(obj, sandLogistics.as_of) : null);
          return sandLogistics?.as_of ? fmtM3(effectiveOnDate) : '—';
        },
      },
      {
        title: 'Карьер',
        key: 'quarry',
        className: 'parameters-table__haul-cell align-top',
        render: (_, obj) => renderSandHaulLegCell(obj.id, sandLogistics, 'quarry'),
      },
      {
        title: 'Объём, м³',
        key: 'haulVolume',
        align: 'right',
        className: 'parameters-table__haul-cell align-top tabular-nums',
        render: (_, obj) => renderSandHaulLegCell(obj.id, sandLogistics, 'volume'),
      },
      {
        title: 'Расстояние, км',
        key: 'haulDistance',
        align: 'right',
        className: 'parameters-table__haul-cell align-top tabular-nums text-[var(--text-muted)]',
        render: (_, obj) => renderSandHaulLegCell(obj.id, sandLogistics, 'distance'),
      },
    ],
    [canWriteProject, sandLogistics, saveMut, savingId],
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
          {canWriteProject
            ? 'Спрос потребителей для расчёта логистики песка. Сохранение при выходе из поля или Enter.'
            : 'Просмотр объёмов спроса песка по объектам'}
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
            {isLoading ? 'Загрузка…' : `${filteredObjects.length} из ${sandObjects.length}`}
          </span>
        </div>

        {sandObjects.length === 0 && !isLoading ? (
          <p className="parameters-empty" style={{ color: 'var(--text-muted)' }}>
            Нет точечных объектов со спросом песка. Добавьте объекты на{' '}
            <ProjectLink to="/map">карте</ProjectLink> (кроме узлов и карьеров).
          </p>
        ) : (
          <AppDataTable
            className="parameters-table"
            rowKey="id"
            loading={isLoading}
            columns={columns}
            dataSource={filteredObjects}
            excelExport={{
              filename: 'parametry-obem-peska.xlsx',
              sheetName: 'Объём песка',
              columns: sandDemandTableExportColumns(sandLogistics),
              rows: filteredObjects,
              disabled: filteredObjects.length === 0,
            }}
          />
        )}
      </Card>
    </div>
  );
}
