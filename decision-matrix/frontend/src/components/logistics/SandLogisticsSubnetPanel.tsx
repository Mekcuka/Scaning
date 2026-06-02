import { Component, useMemo, type ErrorInfo, type ReactNode } from 'react';
import type { SandLogisticsResult, SandLogisticsSubnet } from '../../lib/api';
import { buildSubnetSandLogisticsWarningLines } from '../../lib/sandLogisticsResult';
import { formatEntryDateRu } from '../../lib/infraEntryDate';
import {
  SandLogisticsConsumerDistanceChart,
  SandLogisticsQuarryAllocationChart,
} from './SandLogisticsCharts';
import { SandLogisticsFlowSchematic } from './SandLogisticsFlowSchematic';
import {
  SandLogisticsConsumerTable,
  SandLogisticsQuarryTable,
} from './SandLogisticsTables';

class ChartsErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Sand logistics charts:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <p className="text-sm text-[var(--text-muted)] col-span-full">
          Не удалось отобразить диаграммы. Данные доступны в таблицах ниже.
        </p>
      );
    }
    return this.props.children;
  }
}

class SchematicErrorBoundary extends Component<
  { children: ReactNode; resetKey?: string },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prevProps: { resetKey?: string }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Sand logistics schematic:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <p className="text-sm text-[var(--text-muted)] py-4">
          Не удалось построить схему. Проверьте сеть на карте и таблицы ниже.
        </p>
      );
    }
    return this.props.children;
  }
}

function subnetTabLabel(subnet: SandLogisticsSubnet): string {
  const match = /^Подсеть\s+(\d+)/.exec(subnet.name);
  if (match) return `Подсеть ${match[1]}`;
  return subnet.name.length > 28 ? `${subnet.name.slice(0, 26)}…` : subnet.name;
}

export function subnetTabTitle(subnet: SandLogisticsSubnet): string {
  return `${subnet.name} · ${subnet.quarry_count} карьер(ов) · ${subnet.consumer_count} потребит.`;
}

export { subnetTabLabel };

export function SandLogisticsSubnetPanel({
  canonicalSubnet,
  sliceSubnet,
  subnet,
  result,
  viewAsOf,
  onViewAsOfChange,
}: {
  canonicalSubnet?: SandLogisticsSubnet;
  sliceSubnet?: SandLogisticsSubnet;
  /** @deprecated use sliceSubnet */
  subnet?: SandLogisticsSubnet;
  result: SandLogisticsResult;
  viewAsOf?: string;
  onViewAsOfChange?: (next: string) => void;
}) {
  const layoutSubnet = canonicalSubnet ?? subnet ?? sliceSubnet!;
  const tableSubnet = sliceSubnet ?? subnet ?? canonicalSubnet!;

  const warningLines = useMemo(
    () => buildSubnetSandLogisticsWarningLines(tableSubnet, result),
    [tableSubnet, result]
  );

  const totalDemand = useMemo(
    () => tableSubnet.consumers.reduce((s, c) => s + (c.in_service ? c.demand_m3 : 0), 0),
    [tableSubnet.consumers]
  );
  const totalAllocated = useMemo(
    () => tableSubnet.consumers.reduce((s, c) => s + c.greedy_allocated_m3, 0),
    [tableSubnet.consumers]
  );

  const sliceDate = viewAsOf ?? result.as_of;

  return (
    <div className="space-y-6" role="tabpanel" aria-label={tableSubnet.name}>
      <div>
        <h2 className="text-lg font-semibold">{tableSubnet.name}</h2>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          {tableSubnet.autoroad_edge_count} рёбер автодорог · карьеров {tableSubnet.quarry_count} ·
          потребителей {tableSubnet.consumer_count} · спрос {totalDemand.toLocaleString('ru-RU')} м³ ·
          отгружено {totalAllocated.toLocaleString('ru-RU')} м³
          {viewAsOf && viewAsOf !== result.as_of
            ? ` · срез на ${formatEntryDateRu(sliceDate)} (накопительно)`
            : ''}
        </p>
      </div>

      {warningLines.length > 0 && (
        <div
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
          role="status"
        >
          <p className="font-medium mb-1">Предупреждения подсети</p>
          <ul className="list-disc pl-5 space-y-1 text-[var(--text-muted)]">
            {warningLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-base font-semibold mb-2">Схема движения песка</h3>
        <SchematicErrorBoundary resetKey={String(layoutSubnet.subnet_index)}>
          <SandLogisticsFlowSchematic
            layoutSubnet={layoutSubnet}
            sliceSubnet={tableSubnet}
            asOf={sliceDate}
            horizonFrom={result.horizon_from}
            horizonTo={result.horizon_to}
            viewAsOf={sliceDate}
            onViewAsOfChange={onViewAsOfChange}
          />
        </SchematicErrorBoundary>
      </div>

      <div>
        <h3 className="text-base font-semibold mb-2">Карьеры</h3>
        <SandLogisticsQuarryTable rows={tableSubnet.quarries} />
      </div>

      <ChartsErrorBoundary>
        <div className="grid gap-6 lg:grid-cols-2">
          <SandLogisticsQuarryAllocationChart quarries={tableSubnet.quarries} />
          <SandLogisticsConsumerDistanceChart consumers={tableSubnet.consumers} />
        </div>
      </ChartsErrorBoundary>

      <div>
        <h3 className="text-base font-semibold mb-2">Потребители</h3>
        <SandLogisticsConsumerTable rows={tableSubnet.consumers} />
      </div>
    </div>
  );
}
