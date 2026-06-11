import type { POI } from '../../lib/api';
import {
  buildMatrixCardModel,
  partitionMatrixRowsForCardGroups,
  poiColumnHasExceed,
  type MatrixCardModel,
} from '../../lib/matrixCardView';
import type { MatrixRow, PoiColumnAnalysis } from '../../lib/matrixData';

type Props = {
  matrixRows: MatrixRow[];
  columnNames: string[];
  columnAnalysis: PoiColumnAnalysis[];
  poisByColumn: POI[];
  selectedCol: number;
  onSelectCol: (index: number) => void;
};

function MatrixCard({ model }: { model: MatrixCardModel }) {
  const activeIdx = model.alternatives.findIndex((a) => a.active);
  return (
    <article className="matrix-card">
      <h3 className="matrix-card-title">
        {model.title}
        {model.exceeds ? <span className="matrix-card-warn">!</span> : null}
      </h3>
      <div className="matrix-card-body">
        <div className="matrix-opts">
          {model.alternatives.map((alt, oi) => (
            <span
              key={`${model.title}-${oi}-${alt.label}`}
              className={
                oi === activeIdx ? 'matrix-opt matrix-opt--base' : 'matrix-opt matrix-opt--alt'
              }
            >
              {alt.label}
            </span>
          ))}
        </div>
      </div>
      {model.footer ? <div className="matrix-card-foot tabular">{model.footer}</div> : null}
    </article>
  );
}

export function MatrixCardsPanel({
  matrixRows,
  columnNames,
  columnAnalysis,
  poisByColumn,
  selectedCol,
  onSelectCol,
}: Props) {
  const safeCol = Math.min(selectedCol, Math.max(0, columnNames.length - 1));
  const poi = poisByColumn[safeCol];
  const column = columnAnalysis[safeCol] ?? { rows: [], total_cost_mln: null };
  const groups = partitionMatrixRowsForCardGroups(matrixRows, column, poi);
  const hasCards = groups.length > 0;

  const renderCard = (row: MatrixRow) => (
    <MatrixCard
      key={`${row.section}-${row.label}-${row.engineeringKey ?? row.subtype}`}
      model={buildMatrixCardModel(row, safeCol, poi, column)}
    />
  );

  return (
    <div className="matrix-cards-wrapper">
      <p className="matrix-fr-hint">
        Детализация выбранной точки: зелёный — выбранный вариант, синий — альтернатива
      </p>

      <div className="matrix-scenario-tabs" role="tablist" aria-label="Точки интереса">
        {columnNames.map((name, i) => {
          const col = columnAnalysis[i];
          const total = col?.total_cost_mln;
          const active = i === safeCol;
          const exceed = col ? poiColumnHasExceed(col) : false;
          return (
            <button
              key={poisByColumn[i]?.id ?? `${name}-${i}`}
              type="button"
              role="tab"
              aria-selected={active}
              className={`matrix-scenario-tab${active ? ' active' : ''}${exceed ? ' has-exceed' : ''}`}
              onClick={() => onSelectCol(i)}
            >
              {name}
              {total != null ? (
                <>
                  {' '}
                  · <span className="tabular">{total.toLocaleString('ru-RU')}</span> млн
                </>
              ) : null}
            </button>
          );
        })}
      </div>

      {hasCards ? (
        <div className="matrix-cards-grid">
          {groups.map(({ section, rows }) => (
            <section key={section} className="matrix-cards-section">
              <h2 className="matrix-cards-section-title">{section}</h2>
              <div className="matrix-cards-col">{rows.map(renderCard)}</div>
            </section>
          ))}
        </div>
      ) : (
        <p className="matrix-fr-hint">
          Нет данных анализа для выбранной точки. Выполните анализ окружения на карте или в матрице.
        </p>
      )}

      <div className="matrix-template-legend">
        <div className="matrix-template-legend-items">
          <span className="matrix-legend-item">
            <span className="legend-swatch legend-swatch--base" />
            Выбрано (базовый вариант)
          </span>
          <span className="matrix-legend-item">
            <span className="legend-swatch legend-swatch--alt" />
            Альтернативный
          </span>
        </div>
      </div>
    </div>
  );
}
