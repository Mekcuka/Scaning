import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import { LayoutGrid, Table as TableIcon, Zap } from 'lucide-react';
import { Button, Card, Space, Tag } from 'antd';
import {
  defaultMapAnalysisApi,
  defaultProjectsPoiWriteApi,
  normalizePoiAnalysisResponse,
  type POI,
} from '../lib/api';
import { analyzeAllPoisAndWait } from '../lib/runApiJob';
import {
  buildMatrixRowsByPois,
  engineeringAppliesToFluid,
  resolvePoiColumnAnalysis,
} from '../lib/matrixData';
import { engineeringOptionsForKey, type EngineeringParamKey } from '../lib/poiParams';
import { useSyncAssistantUiContext } from '../lib/assistant/assistantContext';
import { useActiveProject } from '../hooks/useActiveProject';
import { useProjectPois } from '../hooks/useProjectData';
import { useAppStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';
import { queryKeys } from '../lib/queryKeys';
import { AppSelect } from '../components/AppSelect';
import { AppDataTable } from '../components/AppDataTable';
import { MatrixCardsPanel } from '../components/matrix/MatrixCardsPanel';
import type { MatrixRow } from '../lib/matrixData';
import { getMatrixSectionOrder } from '../lib/matrixCardView';
import { useIsMobile } from '../hooks/useMediaQuery';
import { usePageHeader } from '../components/layout/pageHeaderContext';

type MatrixTableRecord =
  | { key: string; rowType: 'section'; section: string }
  | { key: string; rowType: 'data'; matrixRow: MatrixRow };

const MATRIX_LABEL_COL_WIDTH = 220;
const MATRIX_POI_COL_WIDTH = 264;

function initialMatrixViewMode(isMobile: boolean): 'table' | 'cards' {
  return isMobile ? 'cards' : 'table';
}

export function MatrixPage() {
  const { canWriteProject } = usePermissions();
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => initialMatrixViewMode(isMobile));
  const [viewModeTouched, setViewModeTouched] = useState(false);
  const [selectedCol, setSelectedCol] = useState(0);
  const { projectId } = useActiveProject();
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);

  useEffect(() => {
    if (!viewModeTouched) {
      setViewMode(isMobile ? 'cards' : 'table');
    }
  }, [isMobile, viewModeTouched]);

  const { data: pois = [] } = useProjectPois(projectId);

  const analysisQueries = useQueries({
    queries: pois.map((poi) => ({
      queryKey: projectId ? queryKeys.analysis(projectId, poi.id) : ['analysis', null, poi.id],
      queryFn: async () => {
        const raw = await defaultMapAnalysisApi.getPoiAnalysis(projectId!, poi.id);
        return normalizePoiAnalysisResponse(raw);
      },
      enabled: !!projectId,
      retry: false,
    })),
  });

  const analysisByPoiId = useMemo(() => {
    const map: Record<string, ReturnType<typeof resolvePoiColumnAnalysis>> = {};
    pois.forEach((poi, i) => {
      const live = analysisQueries[i]?.data;
      map[poi.id] = resolvePoiColumnAnalysis(poi, live);
    });
    return map;
  }, [pois, analysisQueries]);

  const columnAnalysis = useMemo(
    () => pois.map((poi) => analysisByPoiId[poi.id] ?? { rows: [], total_cost_mln: null }),
    [pois, analysisByPoiId]
  );

  const { rows: matrixRows, columnNames, poisByColumn } = useMemo(
    () => buildMatrixRowsByPois(pois, columnAnalysis),
    [pois, columnAnalysis]
  );

  const safeSelectedCol = Math.min(selectedCol, Math.max(0, columnNames.length - 1));
  const selectedMatrixPoi = poisByColumn[safeSelectedCol] ?? null;
  useSyncAssistantUiContext({
    selectedPoiId: selectedMatrixPoi?.id ?? null,
    selectedPoiName: selectedMatrixPoi?.name ?? null,
  });

  const sections = useMemo(() => getMatrixSectionOrder(matrixRows), [matrixRows]);

  const colCount = columnNames.length + 1;

  const matrixTableWidth = useMemo(
    () => MATRIX_LABEL_COL_WIDTH + columnNames.length * MATRIX_POI_COL_WIDTH,
    [columnNames.length],
  );

  const matrixTableData = useMemo<MatrixTableRecord[]>(() => {
    const data: MatrixTableRecord[] = [];
    for (const section of sections) {
      data.push({ key: `section-${section}`, rowType: 'section', section });
      for (const row of matrixRows.filter((r) => r.section === section)) {
        data.push({ key: `${row.section}-${row.label}`, rowType: 'data', matrixRow: row });
      }
    }
    return data;
  }, [matrixRows, sections]);

  const analyzeMut = useMutation({
    mutationFn: () => analyzeAllPoisAndWait(projectId!),
    onSuccess: async (batch) => {
      if (!projectId) return;
      for (const item of batch.results) {
        queryClient.setQueryData(
          ['analysis', projectId, item.poi_id],
          normalizePoiAnalysisResponse(item)
        );
      }
      pushToast(
        'success',
        batch.analyzed_count === 1
          ? 'Анализ окружения выполнен для 1 точки'
          : `Анализ окружения выполнен для ${batch.analyzed_count} точек`
      );
    },
    onError: (err) => {
      pushToast(
        'error',
        err instanceof Error ? err.message : 'Не удалось выполнить анализ окружения'
      );
    },
  });

  const updateEngMut = useMutation({
    mutationFn: async ({
      poiId,
      key,
      value,
    }: {
      poiId: string;
      key: EngineeringParamKey;
      value: string;
    }) => {
      return defaultProjectsPoiWriteApi.updatePoi(projectId!, poiId, { [key]: value } as Partial<POI>);
    },
    onSuccess: (updated) => {
      if (!projectId) return;
      queryClient.setQueryData<POI[]>(['pois', projectId], (prev) =>
        (prev ?? []).map((p) => (p.id === updated.id ? updated : p))
      );
      queryClient.removeQueries({ queryKey: ['analysis', projectId, updated.id] });
      pushToast('success', 'Изменения сохранены');
    },
    onError: (err) => {
      pushToast(
        'error',
        err instanceof Error ? err.message : 'Не удалось сохранить параметр'
      );
    },
  });

  const matrixColumns = useMemo<ColumnsType<MatrixTableRecord>>(() => {
    const poiColumns: ColumnsType<MatrixTableRecord> = columnNames.map((name, i) => ({
      title: <span className="matrix-table__poi-title">{name}</span>,
      key: `poi-${i}`,
      width: MATRIX_POI_COL_WIDTH,
      onHeaderCell: () => ({
        className: [
          'matrix-table__poi-col',
          safeSelectedCol === i ? 'matrix-table__poi-col--selected' : '',
        ]
          .filter(Boolean)
          .join(' '),
        onClick: () => setSelectedCol(i),
        title: poisByColumn[i]?.name,
      }),
      onCell: (record) => {
        if (record.rowType === 'section') {
          return { colSpan: 0 };
        }
        return {
          className: [
            'matrix-table__poi-col',
            safeSelectedCol === i ? 'matrix-table__poi-col--selected' : '',
          ]
            .filter(Boolean)
            .join(' '),
        };
      },
      render: (_, record) => {
        if (record.rowType === 'section') return null;
        const row = record.matrixRow;
        const cell = row.cells[i];
        const poi = poisByColumn[i];
        const engKey = row.engineeringKey;
        const engEditable =
          engKey && poi && engineeringAppliesToFluid(engKey, poi.fluid_type);

        const cellClass = [
          row.total ? 'matrix-table__cell--total' : '',
          cell.status === 'exceeds_limit' ? 'matrix-table__cell--exceed' : '',
          cell.text === '—' ? 'matrix-table__cell--empty' : '',
          engEditable ? 'matrix-eng-cell' : '',
        ]
          .filter(Boolean)
          .join(' ');

        const content = engEditable ? (
          <AppSelect
            variant="compact"
            className="matrix-eng-select"
            ariaLabel={`${row.label}: ${poi.name}`}
            value={String(poi[engKey] ?? '')}
            readOnly={!canWriteProject}
            disabled={updateEngMut.isPending || !canWriteProject}
            onChange={(value) => {
              if (value === poi[engKey]) return;
              updateEngMut.mutate({
                poiId: poi.id,
                key: engKey,
                value,
              });
            }}
            options={engineeringOptionsForKey(engKey)}
          />
        ) : cell.badge ? (
          <Tag>{cell.text}</Tag>
        ) : cell.subtext ? (
          <div className="matrix-cell-stacked">
            <div className="matrix-cell-cost">{cell.text}</div>
            <div className="matrix-cell-detail">{cell.subtext}</div>
          </div>
        ) : (
          cell.text
        );

        return engEditable ? (
          <div className={cellClass} onClick={(e) => e.stopPropagation()}>
            {content}
          </div>
        ) : (
          <span className={cellClass}>{content}</span>
        );
      },
    }));

    return [
      {
        title: 'Параметр',
        key: 'label',
        width: MATRIX_LABEL_COL_WIDTH,
        ellipsis: true,
        className: 'matrix-table__label-col',
        onCell: (record) => {
          if (record.rowType === 'section') {
            return {
              colSpan: colCount,
              className: 'matrix-table__section-cell',
            };
          }
          return { className: 'matrix-table__label-cell' };
        },
        render: (_, record) =>
          record.rowType === 'section' ? record.section : record.matrixRow.label,
      },
      ...poiColumns,
    ];
  }, [
    canWriteProject,
    colCount,
    columnNames,
    poisByColumn,
    safeSelectedCol,
    updateEngMut,
  ]);

  usePageHeader(
    {
      title: 'Матрица решений',
      subtitle: 'Сравнение анализа окружения по всем точкам интереса проекта',
    },
    [],
  );

  return (
    <div>
      <div className="page-toolbar page-toolbar--actions-only">
        <div className="page-toolbar-actions">
          {projectId && pois.length > 0 && canWriteProject && (
            <Button
              type="primary"
              icon={<Zap size={16} />}
              loading={analyzeMut.isPending}
              onClick={() => analyzeMut.mutate()}
              title={
                pois.length > 1
                  ? `Пересчитать анализ для всех ${pois.length} точек`
                  : 'Пересчитать анализ окружения'
              }
            >
              {analyzeMut.isPending
                ? 'Расчёт…'
                : pois.length > 1
                  ? `Анализ (${pois.length})`
                  : 'Анализ'}
            </Button>
          )}
          <Space>
            <Button
              type={viewMode === 'table' ? 'primary' : 'default'}
              icon={<TableIcon size={16} />}
              onClick={() => {
                setViewModeTouched(true);
                setViewMode('table');
              }}
            >
              Таблица
            </Button>
            <Button
              type={viewMode === 'cards' ? 'primary' : 'default'}
              icon={<LayoutGrid size={16} />}
              onClick={() => {
                setViewModeTouched(true);
                setViewMode('cards');
              }}
            >
              Карточки
            </Button>
          </Space>
        </div>
      </div>

      {pois.length === 0 ? (
            <Card>
              <p className="text-sm mb-0" style={{ color: 'var(--text-muted)' }}>
                В проекте нет точек интереса. Добавьте POI на карте.
              </p>
            </Card>
          ) : viewMode === 'table' ? (
            <Card
              className="matrix-table-wrap"
              style={{ width: matrixTableWidth, maxWidth: '100%' }}
              styles={{ body: { padding: 0 } }}
            >
              <AppDataTable
                className="matrix-table"
                rowKey="key"
                tableLayout="fixed"
                scroll={{}}
                columns={matrixColumns}
                dataSource={matrixTableData}
                onRow={(record) => {
                  if (record.rowType === 'section') {
                    return { className: 'matrix-table__section-row' };
                  }
                  if (record.matrixRow.total) {
                    return { className: 'matrix-table__row--total' };
                  }
                  return {};
                }}
              />
            </Card>
          ) : (
            <MatrixCardsPanel
              matrixRows={matrixRows}
              columnNames={columnNames}
              columnAnalysis={columnAnalysis}
              poisByColumn={poisByColumn}
              selectedCol={safeSelectedCol}
              onSelectCol={setSelectedCol}
            />
          )}
    </div>
  );
}
