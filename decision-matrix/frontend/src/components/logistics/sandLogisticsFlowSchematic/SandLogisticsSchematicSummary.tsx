export function SandLogisticsSchematicSummary({
  totalDemandM3,
  totalAllocatedM3,
  unmetM3,
}: {
  totalDemandM3: number;
  totalAllocatedM3: number;
  unmetM3: number;
}) {
  const coveragePct =
    totalDemandM3 > 0
      ? Math.min(100, Math.round((totalAllocatedM3 / totalDemandM3) * 100))
      : totalAllocatedM3 > 0
        ? 100
        : null;

  return (
    <div className="sand-schematic-summary">
      <div className="sand-schematic-metric">
        <span className="sand-schematic-metric__label">Спрос</span>
        <span className="sand-schematic-metric__value">
          {totalDemandM3.toLocaleString('ru-RU')}{' '}
          <span className="sand-schematic-metric__unit">м³</span>
        </span>
      </div>
      <div className="sand-schematic-metric sand-schematic-metric--ok">
        <span className="sand-schematic-metric__label">Отгружено</span>
        <span className="sand-schematic-metric__value">
          {totalAllocatedM3.toLocaleString('ru-RU')}{' '}
          <span className="sand-schematic-metric__unit">м³</span>
        </span>
      </div>
      {coveragePct != null && (
        <div className="sand-schematic-metric">
          <span className="sand-schematic-metric__label">Покрытие</span>
          <span className="sand-schematic-metric__value">{coveragePct}%</span>
        </div>
      )}
      {unmetM3 > 0 && (
        <div className="sand-schematic-metric sand-schematic-metric--warn">
          <span className="sand-schematic-metric__label">Не покрыто</span>
          <span className="sand-schematic-metric__value">
            {unmetM3.toLocaleString('ru-RU')}{' '}
            <span className="sand-schematic-metric__unit">м³</span>
          </span>
        </div>
      )}
    </div>
  );
}
