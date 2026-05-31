export function PageSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="p-6 animate-pulse" aria-busy="true" aria-label="Загрузка">
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="h-4 rounded mb-3"
          style={{ background: 'var(--border)', width: `${90 - i * 10}%` }}
        />
      ))}
    </div>
  );
}
