import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LayoutGrid, Table } from 'lucide-react';
import { api } from '../lib/api';
import { buildMatrixRows, connectionLinesForColumn } from '../lib/matrixData';
import { useAppStore } from '../store';
import { MapView } from '../components/MapView';
import { PoiParamsPanel } from '../components/PoiParamsPanel';

const FALLBACK_SCENARIOS = ['Базовый', 'Сценарий 1', 'Сценарий 2'];

export function MatrixPage() {
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedCol, setSelectedCol] = useState(0);
  const [showOnlyExceeded, setShowOnlyExceeded] = useState(false);
  const projectId = useAppStore((s) => s.currentProjectId);

  const { data: pois = [] } = useQuery({
    queryKey: ['pois', projectId],
    queryFn: () => api.getPois(projectId!),
    enabled: !!projectId,
  });

  const { data: infraObjects = [] } = useQuery({
    queryKey: ['infra', projectId],
    queryFn: () => api.getInfraObjects(projectId!),
    enabled: !!projectId,
  });

  const { data: layers = [] } = useQuery({
    queryKey: ['layers', projectId],
    queryFn: () => api.getLayers(projectId!),
    enabled: !!projectId,
  });

  const { data: scenarios = [] } = useQuery({
    queryKey: ['scenarios', projectId],
    queryFn: () => api.getScenarios(projectId!),
    enabled: !!projectId,
  });

  const displayedScenarios = useMemo(() => {
    if (!showOnlyExceeded) return scenarios;
    return scenarios.filter((scenario) => {
      const analysis = (scenario.results?.analysis as Array<{ status?: string }> | undefined) || [];
      return analysis.some((row) => row.status === 'exceeds_limit');
    });
  }, [scenarios, showOnlyExceeded]);

  const { rows: matrixRows, scenarioNames, poiByColumn } = useMemo(
    () => buildMatrixRows(displayedScenarios, pois, FALLBACK_SCENARIOS),
    [displayedScenarios, pois]
  );

  const selectedPoi = poiByColumn[selectedCol] ?? pois[0] ?? null;

  const { data: liveAnalysis } = useQuery({
    queryKey: ['analysis', projectId, selectedPoi?.id],
    queryFn: () => api.getPoiAnalysis(projectId!, selectedPoi!.id),
    enabled: !!projectId && !!selectedPoi?.id,
    retry: false,
  });

  const connectionLines = connectionLinesForColumn(displayedScenarios, selectedCol, pois, liveAnalysis?.rows);

  const sections = useMemo(() => {
    const seen = new Set<string>();
    return matrixRows.reduce<string[]>((acc, r) => {
      if (!seen.has(r.section)) {
        seen.add(r.section);
        acc.push(r.section);
      }
      return acc;
    }, []);
  }, [matrixRows]);

  const colCount = scenarioNames.length + 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Матрица решений</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Данные из сценариев и анализа POI (FR-8)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className={`btn ${showOnlyExceeded ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setShowOnlyExceeded((v) => !v);
              setSelectedCol(0);
            }}
          >
            Только с превышениями
          </button>
          <button
            type="button"
            className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('table')}
          >
            <Table size={16} /> Таблица
          </button>
          <button
            type="button"
            className={`btn ${viewMode === 'cards' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('cards')}
          >
            <LayoutGrid size={16} /> Карточки
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          {viewMode === 'table' ? (
            <div className="card p-0 table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Параметр</th>
                    {scenarioNames.map((s, i) => (
                      <th
                        key={s + i}
                        className={`cursor-pointer ${selectedCol === i ? 'bg-blue-50' : ''}`}
                        onClick={() => setSelectedCol(i)}
                      >
                        {s}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sections.map((section) => (
                    <Fragment key={section}>
                      <tr>
                        <td colSpan={colCount} className="font-semibold bg-gray-50 text-xs uppercase tracking-wide">
                          {section}
                        </td>
                      </tr>
                      {matrixRows
                        .filter((r) => r.section === section)
                        .map((row) => (
                          <tr key={row.label}>
                            <td>{row.label}</td>
                            {row.cells.map((cell, i) => (
                              <td
                                key={i}
                                className={`${row.total ? 'font-bold' : ''} ${
                                  cell.status === 'exceeds_limit' ? 'text-red-600' : ''
                                }`}
                              >
                                {cell.badge ? (
                                  <span className="badge badge-secondary">{cell.text}</span>
                                ) : (
                                  cell.text
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {scenarioNames.map((s, i) => {
                const total = displayedScenarios[i]?.results?.total_cost_mln;
                return (
                  <div
                    key={s + i}
                    className={`card cursor-pointer ${selectedCol === i ? 'ring-2 ring-blue-500' : ''}`}
                    onClick={() => setSelectedCol(i)}
                  >
                    <h3 className="font-semibold mb-3">{s}</h3>
                    <div className="text-2xl font-bold text-blue-600 mb-2">
                      {total != null ? `${total} млн ₽` : '—'}
                    </div>
                    <div className="text-sm space-y-1" style={{ color: 'var(--text-muted)' }}>
                      {poiByColumn[i]?.name && <div>POI: {poiByColumn[i]!.name}</div>}
                      {!displayedScenarios[i]?.results && (
                        <div className="text-xs">Запустите анализ на карте</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="card mb-4">
            <h3 className="font-semibold mb-2">
              Мини-карта: {scenarioNames[selectedCol] || 'Сценарий'}
              {selectedPoi ? ` · ${selectedPoi.name}` : ''}
            </h3>
            <MapView
              pois={pois}
              infraObjects={infraObjects}
              selectedPoi={selectedPoi}
              connectionLines={connectionLines}
              height="250px"
              useMapIcons
              layers={layers}
            />
          </div>
          <PoiParamsPanel
            projectId={projectId}
            poiId={selectedPoi?.id ?? null}
            onPoiChange={() => {}}
            className="p-3"
          />
        </div>
      </div>
    </div>
  );
}
