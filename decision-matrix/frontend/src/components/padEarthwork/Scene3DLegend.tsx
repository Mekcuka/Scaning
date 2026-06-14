export type Scene3DLegendProps = {
  demActive: boolean;
  envelopeActive: boolean;
  showWellheads?: boolean;
  showBottomholes?: boolean;
  showTrajectories?: boolean;
  /** `overlay` — компактная карточка поверх 3D; `inline` — боковая панель модалки */
  variant?: 'inline' | 'overlay';
};

const ENVELOPE_HINT =
  'Кольцо на верху насыпи (откосы 1:1, бровка на H = (W−TW)/2)';

export function Scene3DLegend({
  demActive,
  envelopeActive,
  showWellheads = false,
  showBottomholes = false,
  showTrajectories = false,
  variant = 'inline',
}: Scene3DLegendProps) {
  const compact = variant === 'overlay';

  return (
    <div
      className={`pad-scene3d-legend${compact ? ' pad-scene3d-legend--overlay' : ''}`}
      aria-label="Легенда 3D-сцены"
    >
      <h4 className="pad-scene3d-legend__title">Легенда</h4>
      <ul className="pad-scene3d-legend__list">
        <li
          className={`pad-scene3d-legend__item${demActive ? '' : ' pad-scene3d-legend__item--muted'}`}
        >
          <span className="pad-scene3d-legend__marker" aria-hidden>
            <span
              className={`pad-scene3d-legend__swatch pad-scene3d-legend__swatch--terrain${demActive ? '' : ' pad-scene3d-legend__swatch--muted'}`}
            />
          </span>
          <span className="pad-scene3d-legend__text">
            {demActive
              ? compact
                ? 'Рельеф DEM'
                : 'Рельеф DEM (сетка preview)'
              : compact
                ? 'Плоскость KB'
                : 'Плоскость на опорной отметке'}
          </span>
        </li>
        <li className="pad-scene3d-legend__item">
          <span className="pad-scene3d-legend__marker" aria-hidden>
            <span className="pad-scene3d-legend__swatch pad-scene3d-legend__swatch--pad" />
          </span>
          <span className="pad-scene3d-legend__text">
            {compact ? 'Площадка' : 'Призма площадки'}
          </span>
        </li>
        {envelopeActive && (
          <li className="pad-scene3d-legend__item">
            <span className="pad-scene3d-legend__marker" aria-hidden>
              <span className="pad-scene3d-legend__swatch pad-scene3d-legend__swatch--envelope" />
            </span>
            <span className="pad-scene3d-legend__text" title={ENVELOPE_HINT}>
              {compact ? 'Обваловка' : `Обваловка — ${ENVELOPE_HINT}`}
            </span>
          </li>
        )}
        {showWellheads && (
          <li className="pad-scene3d-legend__item">
            <span className="pad-scene3d-legend__marker" aria-hidden>
              <span className="pad-scene3d-legend__swatch pad-scene3d-legend__swatch--wellhead pad-scene3d-legend__swatch--dot" />
            </span>
            <span className="pad-scene3d-legend__text">
              {compact ? 'Устья' : 'Устья скважин'}
            </span>
          </li>
        )}
        {showBottomholes && (
          <li className="pad-scene3d-legend__item">
            <span className="pad-scene3d-legend__marker" aria-hidden>
              <span className="pad-scene3d-legend__swatch pad-scene3d-legend__swatch--trajectory pad-scene3d-legend__swatch--dot" />
            </span>
            <span className="pad-scene3d-legend__text">
              {compact ? 'Забои' : 'Маркеры забоев (ННБ / GS)'}
            </span>
          </li>
        )}
        {showTrajectories && (
          <li className="pad-scene3d-legend__item">
            <span className="pad-scene3d-legend__marker" aria-hidden>
              <span className="pad-scene3d-legend__swatch pad-scene3d-legend__swatch--trajectory pad-scene3d-legend__swatch--line" />
            </span>
            <span className="pad-scene3d-legend__text">
              {compact ? 'Траектории' : 'Траектории стволов'}
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}
