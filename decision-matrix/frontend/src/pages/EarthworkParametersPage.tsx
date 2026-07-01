import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ProjectLink } from '../components/ProjectLink';
import { MapPin, Search } from 'lucide-react';
import { Button, Card, Input } from 'antd';
import { SUBTYPE_LABELS, defaultMapMutationsApi, type InfraObject } from '../lib/api';
import { padEarthworkApi } from '../lib/api/padEarthworkApi';
import {
  isEarthworkEligibleSubtype,
  mergePadEarthworkParam,
  padEarthworkPatchBody,
  padParamDisplayValue,
  parsePadParamCommit,
  type PadEarthworkParamField,
} from '../lib/infraPadEarthwork';
import { useAppStore } from '../store';
import { useActiveProject } from '../hooks/useActiveProject';
import { useProjectInfraObjects } from '../hooks/useProjectData';
import { usePermissions } from '../hooks/usePermissions';
import { queryKeys } from '../lib/queryKeys';
import type { ColumnsType } from 'antd/es/table';
import { DeferredNumberInput } from '../components/DeferredNumberInput';
import { AppDataTable } from '../components/AppDataTable';
import { earthworkTableExportColumns } from '../lib/tableExcelExportData';

const EARTHWORK_COLUMNS: { field: PadEarthworkParamField; label: string; min?: number; max?: number }[] = [
  { field: 'length_m', label: 'Длина, м', min: 0 },
  { field: 'width_m', label: 'Ширина, м', min: 0 },
  { field: 'height_m', label: 'Высота насыпи, м', min: 0 },
  { field: 'reference_elevation_m', label: 'Опорная отметка, м' },
  { field: 'rotation_deg', label: 'Поворот / НДС, °', min: 0, max: 360 },
];

export function EarthworkParametersPage() {
  const { canWriteProject } = usePermissions();
  const { projectId } = useActiveProject();
  const pushToast = useAppStore((s) => s.pushToast);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: infraObjects = [], isLoading } = useProjectInfraObjects(projectId, {
    refetchOnMount: 'always',
  });

  const earthworkObjects = useMemo(
    () =>
      infraObjects
        .filter((o) => isEarthworkEligibleSubtype(o.subtype))
        .sort((a, b) => {
          const subtypeCmp = (SUBTYPE_LABELS[a.subtype] || a.subtype).localeCompare(
            SUBTYPE_LABELS[b.subtype] || b.subtype,
            'ru',
          );
          if (subtypeCmp !== 0) return subtypeCmp;
          return a.name.localeCompare(b.name, 'ru');
        }),
    [infraObjects],
  );

  const filteredObjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return earthworkObjects;
    return earthworkObjects.filter((o) => {
      const subtypeLabel = (SUBTYPE_LABELS[o.subtype] || o.subtype).toLowerCase();
      return o.name.toLowerCase().includes(q) || subtypeLabel.includes(q);
    });
  }, [earthworkObjects, search]);

  const saveMut = useMutation({
    mutationFn: async ({
      object,
      field,
      value,
    }: {
      object: InfraObject;
      field: PadEarthworkParamField;
      value: number | null;
    }) => {
      if (value == null) {
        return defaultMapMutationsApi.updateInfraObject(projectId!, object.id, {
          properties: mergePadEarthworkParam(object.properties, field, null),
        });
      }
      return padEarthworkApi.patchParams(
        projectId!,
        object.id,
        padEarthworkPatchBody(field, value),
      );
    },
    onMutate: ({ object, field, value }) => {
      setSavingId(object.id);
      queryClient.setQueryData<InfraObject[]>(['infra', projectId], (prev) =>
        (prev ?? []).map((o) =>
          o.id === object.id
            ? { ...o, properties: mergePadEarthworkParam(o.properties, field, value) }
            : o,
        ),
      );
    },
    onSuccess: (_data, { object }) => {
      pushToast('success', 'Параметры площадки сохранены');
      void queryClient.invalidateQueries({ queryKey: ['padEarthworkLast', projectId, object.id] });
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
      ...EARTHWORK_COLUMNS.map((col) => ({
        title: col.label,
        key: col.field,
        render: (_: unknown, obj: InfraObject) => {
          const isSaving = savingId === obj.id;
          return (
            <DeferredNumberInput
              allowEmpty
              min={col.min}
              max={col.max}
              className="parameters-table__input"
              placeholder="—"
              value={padParamDisplayValue(obj, col.field)}
              readOnly={!canWriteProject}
              disabled={isSaving || !canWriteProject}
              onCommit={(v) => {
                const parsed = parsePadParamCommit(col.field, v);
                if (parsed === undefined) return;
                saveMut.mutate({ object: obj, field: col.field, value: parsed });
              }}
            />
          );
        },
      })),
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
          {canWriteProject
            ? 'Сохранение при выходе из поля или Enter. Схема контура и расчёт объёмов — на карте, вкладка «Логистика».'
            : 'Просмотр параметров площадки объектов'}
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
            {isLoading ? 'Загрузка…' : `${filteredObjects.length} из ${earthworkObjects.length}`}
          </span>
        </div>

        {earthworkObjects.length === 0 && !isLoading ? (
          <p className="parameters-empty" style={{ color: 'var(--text-muted)' }}>
            Нет точечных объектов с земляными работами. Добавьте объекты на{' '}
            <ProjectLink to="/map">карте</ProjectLink> (кроме «Узел» и «Карьер песка»).
          </p>
        ) : (
          <AppDataTable
            className="parameters-table"
            rowKey="id"
            loading={isLoading}
            columns={columns}
            dataSource={filteredObjects}
            excelExport={{
              filename: 'parametry-zemlyanye-raboty.xlsx',
              sheetName: 'Земляные работы',
              columns: earthworkTableExportColumns(),
              rows: filteredObjects,
              disabled: filteredObjects.length === 0,
            }}
          />
        )}
      </Card>
    </div>
  );
}
