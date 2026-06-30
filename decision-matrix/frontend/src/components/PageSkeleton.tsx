import { Skeleton } from 'antd';

export function PageSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="p-6" aria-busy="true" aria-label="Загрузка">
      <Skeleton active paragraph={{ rows: lines }} title={false} />
    </div>
  );
}
