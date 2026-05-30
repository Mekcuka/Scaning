import { Component, useMemo, type ErrorInfo, type ReactNode } from 'react';
import type { SandLogisticsResult, SandLogisticsSubnet } from '../../lib/api';
import { buildSubnetSandLogisticsWarningLines } from '../../lib/sandLogisticsResult';
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
  subnet,
  result,
}: {
  subnet: SandLogisticsSubnet;
  result: SandLogisticsResult;
}) {
  const warningLines = useMemo(
    () => buildSubnetSandLogisticsWarningLines(subnet, result),
    [subnet, result]
  );

  const totalDemand = useMemo(
    () => subnet.consumers.reduce((s, c) => s + (c.in_service ? c.demand_m3 : 0), 0),
    [subnet.consumers]
  );
  const totalAllocated = useMemo(
    () => subnet.consumers.reduce((s, c) => s + c.greedy_allocated_m3, 0),
    [subnet.consumers]
  );

  return (
    <div className="space-y-6" role="tabpanel" aria-label={subnet.name}>
      <div>
        <h2 className="text-lg font-semibold">{subnet.name}</h2>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          {subnet.autoroad_edge_count} рёбер автодорог · карьеров {subnet.quarry_count} ·
          потребителей {subnet.consumer_count} · спрос {totalDemand.toLocaleString('ru-RU')} м³ ·
          отгружено {totalAllocated.toLocaleString('ru-RU')} м³
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
        <SandLogisticsFlowSchematic subnet={subnet} />
      </div>

      <div>
        <h3 className="text-base font-semibold mb-2">Карьеры</h3>
        <SandLogisticsQuarryTable rows={subnet.quarries} />
      </div>

      <ChartsErrorBoundary>
        <div className="grid gap-6 lg:grid-cols-2">
          <SandLogisticsQuarryAllocationChart quarries={subnet.quarries} />
          <SandLogisticsConsumerDistanceChart consumers={subnet.consumers} />
        </div>
      </ChartsErrorBoundary>

      <div>
        <h3 className="text-base font-semibold mb-2">Потребители</h3>
        <SandLogisticsConsumerTable rows={subnet.consumers} />
      </div>
    </div>
  );
}
