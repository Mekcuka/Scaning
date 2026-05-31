import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MapPin, Search } from 'lucide-react';
import { api, SUBTYPE_LABELS, type InfraObject } from '../lib/api';
import {
  mergeEntryDate,
  objectShowsEntryDate,
  readEntryDateIso,
} from '../lib/infraEntryDate';
import { useAppStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';
import {
  TableExcelExportBodyCell,
  TableExcelExportButton,
} from '../components/TableExcelExportButton';
import { entryDateTableExportColumns } from '../lib/tableExcelExportData';

export function EntryDatesParametersPage() {
  const { canWriteProject } = usePermissions();
  const projectId = useAppStore((s) => s.currentProjectId);
  const pushToast = useAppStore((s) => s.pushToast);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: infraObjects = [], isLoading } = useQuery({
    queryKey: ['infra', projectId],
    queryFn: () => api.getInfraObjects(projectId!),
    enabled: !!projectId,
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
      api.updateInfraObject(projectId!, object.id, {
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
      queryClient.invalidateQueries({ queryKey: ['infra', projectId] });
    },
    onSettled: () => setSavingId(null),
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
          Дата ввода в эксплуатацию для точечных и линейных объектов (кроме узлов). Учитывается в
          логистике песка: объекты с датой позже сегодня не участвуют в расчёте.
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
            {isLoading ? 'Загрузка…' : `${filteredObjects.length} из ${datedObjects.length}`}
          </span>
        </div>

        {datedObjects.length === 0 && !isLoading ? (
          <p className="parameters-empty" style={{ color: 'var(--text-muted)' }}>
            Нет объектов. Добавьте инфраструктуру на <Link to="/map">карте</Link>.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table parameters-table">
              <thead>
                <tr>
                  <th scope="col">Объект</th>
                  <th scope="col">Подтип</th>
                  <th scope="col">Дата ввода</th>
                  <th scope="col" className="table-excel-export-th">
                    <TableExcelExportButton
                      filename="parametry-data-vvoda.xlsx"
                      sheetName="Дата ввода"
                      columns={entryDateTableExportColumns()}
                      rows={filteredObjects}
                      disabled={filteredObjects.length === 0}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredObjects.map((obj) => (
                  <tr key={obj.id}>
                    <th scope="row" className="parameters-table__name">
                      {obj.name}
                    </th>
                    <td>{SUBTYPE_LABELS[obj.subtype] || obj.subtype}</td>
                    <td>
                      <input
                        type="date"
                        className="input parameters-table__input"
                        value={readEntryDateIso(obj.properties)}
                        readOnly={!canWriteProject}
                        disabled={savingId === obj.id || !canWriteProject}
                        onChange={(e) => {
                          if (e.target.value) {
                            saveMut.mutate({ object: obj, iso: e.target.value });
                          }
                        }}
                      />
                    </td>
                    <TableExcelExportBodyCell />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
