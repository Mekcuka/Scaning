import type { SandLogisticsSubnet } from '../../../lib/api';

export function subnetTabLabel(subnet: SandLogisticsSubnet): string {
  const match = /^Подсеть\s+(\d+)/.exec(subnet.name);
  if (match) return `Подсеть ${match[1]}`;
  return subnet.name.length > 28 ? `${subnet.name.slice(0, 26)}…` : subnet.name;
}

export function subnetTabTitle(subnet: SandLogisticsSubnet): string {
  return `${subnet.name} · ${subnet.quarry_count} карьер(ов) · ${subnet.consumer_count} потребит.`;
}
