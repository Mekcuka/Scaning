import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ProjectLink } from '../components/ProjectLink';
import { MapPin, Search } from 'lucide-react';
import { Button, Card, Input } from 'antd';
import { defaultMapMutationsApi, SUBTYPE_LABELS, type InfraObject } from '../lib/api';
import {
  mergeEntryDate,
  objectShowsEntryDate,
  readEntryDateIso,
} from '../lib/infraEntryDate';
import { useAppStore } from '../store';
import { useActiveProject } from '../hooks/useActiveProject';
import { useProjectInfraObjects } from '../hooks/useProjectData';
import { usePermissions } from '../hooks/usePermissions';
import { queryKeys } from '../lib/queryKeys';
import type { ColumnsType } from 'antd/es/table';
import { AppDataTable } from '../components/AppDataTable';
import { entryDateTableExportColumns } from '../lib/tableExcelExportData';

export function EntryDatesParametersPage() {
  const { canWriteProject } = usePermissions();
  const { projectId } = useActiveProject();
  const pushToast = useAppStore((s) => s.pushToast);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: infraObjects = [], isLoading } = useProjectInfraObjects(projectId, {
    refetchOnMount: 'always',
  });

  const datedObjects = useMemo(
    () =>
      infraObjects
        .filter((o) => objectShowsEntryDate(o.subtype))
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
    if (!q) return datedObjects;
    return datedObjects.filter((o) => {
      const subtypeLabel = (SUBTYPE_LABELS[o.subtype] || o.subtype).toLowerCase();
      return o.name.toLowerCase().includes(q) || subtypeLabel.includes(q);
    });
  }, [datedObjects, search]);

  const saveMut = useMutation({
    mutationFn: async ({ object, iso }: { object: InfraObject; iso: string }) =>
      defaultMapMutationsApi.updateInfraObject(projectId!, object.id, {
        properties: mergeEntryDate(object.properties, iso),
      }),
    onMutate: ({ object, iso }) => {
      setSavingId(object.id);
      queryClient.setQueryData<InfraObject[]>(['infra', projectId], (prev) =>
        (prev ?? []).map((o) =>
          o.id === object.id ? { ...o, properties: mergeEntryDate(o.properties, iso) } : o
        )
      );
    },
    onSuccess: () => pushToast('success', 'Дата ввода сохранена'),
    onError: (err: Error) => {
      pushToast('error', err.message || 'Не удалось сохранить');
      if (projectId) queryClient.invalidateQueries({ queryKey: queryKeys.infra(projectId) });
    },
    onSettled: () => setSavingId(null),
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
        title: 'Дата ввода',
        key: 'entryDate',
        render: (_, obj) => (
          <Input
            type="date"
            className="parameters-table__input"
            value={readEntryDateIso(obj.properties)}
            readOnly={!canWriteProject}
            disabled={savingId === obj.id || !canWriteProject}
            onChange={(e) => {
              if (e.target.value) {
                saveMut.mutate({ object: obj, iso: e.target.value });
              }
            }}
          />
        ),
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
          Дата ввода в эксплуатацию для точечных и линейных объектов (кроме узлов). Учитывается в
          логистике песка: объекты с датой позже сегодня не участвуют в расчёте.
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
            {isLoading ? 'Загрузка…' : `${filteredObjects.length} из ${datedObjects.length}`}
          </span>
        </div>

        {datedObjects.length === 0 && !isLoading ? (
          <p className="parameters-empty" style={{ color: 'var(--text-muted)' }}>
            Нет объектов. Добавьте инфраструктуру на <ProjectLink to="/map">карте</ProjectLink>.
          </p>
        ) : (
          <AppDataTable
            className="parameters-table"
            rowKey="id"
            loading={isLoading}
            columns={columns}
            dataSource={filteredObjects}
            excelExport={{
              filename: 'parametry-data-vvoda.xlsx',
              sheetName: 'Дата ввода',
              columns: entryDateTableExportColumns(),
              rows: filteredObjects,
              disabled: filteredObjects.length === 0,
            }}
          />
        )}
      </Card>
    </div>
  );
}
