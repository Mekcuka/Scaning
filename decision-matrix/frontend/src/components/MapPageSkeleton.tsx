import { Skeleton } from 'antd';

export function MapPageSkeleton() {
  return (
    <div className="map-page flex flex-1 flex-col min-h-0 overflow-hidden" aria-busy="true" aria-label="Загрузка карты">
      <div
        className="card--flush map-page-card flex flex-1 flex-col min-h-0 overflow-hidden border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)]"
      >
        <div className="shrink-0 border-b border-[var(--border)] px-3 py-2">
          <Skeleton.Button active block style={{ height: 36 }} />
        </div>
        <div className="map-layout flex flex-1 min-h-0">
          <div className="hidden md:block w-[280px] shrink-0 border-r border-[var(--border)] p-3">
            <Skeleton active paragraph={{ rows: 8 }} title={false} />
          </div>
          <div className="map-main-column flex flex-1 min-h-0 flex-col">
            <div className="map-canvas-wrap flex-1 min-h-[320px] p-4">
              <Skeleton.Node active style={{ width: '100%', height: '100%', minHeight: 280 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MapCanvasSkeleton() {
  return (
    <div
      className="map-container map-canvas-skeleton flex h-full min-h-[280px] items-center justify-center"
      aria-busy="true"
      aria-label="Загрузка карты"
      style={{ color: 'var(--text-muted)' }}
    >
      <Skeleton.Node active style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
