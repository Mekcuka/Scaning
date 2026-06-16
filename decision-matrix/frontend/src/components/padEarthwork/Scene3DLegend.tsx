import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type Scene3DLegendProps = {
  demActive: boolean;
  envelopeActive: boolean;
  showWellheads?: boolean;
  showBottomholes?: boolean;
  showTrajectories?: boolean;
  showClearanceSf?: boolean;
  sfWarningThreshold?: number;
  clearanceViolationCount?: number;
  /** `overlay` — компактная карточка поверх 3D; `inline` — боковая панель модалки */
  variant?: 'inline' | 'overlay';
  /** Сворачиваемый заголовок (по умолчанию для overlay) */
  collapsible?: boolean;
  defaultOpen?: boolean;
};

const ENVELOPE_HINT =
  'Кольцо на верху насыпи (откосы 1:1, бровка на H = (W−TW)/2)';

export function Scene3DLegend({
  demActive,
  envelopeActive,
  showWellheads = false,
  showBottomholes = false,
  showTrajectories = false,
  showClearanceSf = false,
  sfWarningThreshold = 1,
  clearanceViolationCount = 0,
  variant = 'inline',
  collapsible,
  defaultOpen,
}: Scene3DLegendProps) {
  const compact = variant === 'overlay';
  const canCollapse = collapsible ?? compact;
  const [open, setOpen] = useState(() => defaultOpen ?? !compact);
  const listId = useId();

  const list = (
    <ul id={canCollapse ? listId : undefined} className="pad-scene3d-legend__list">
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
      {showClearanceSf && (
        <>
          <li className="pad-scene3d-legend__item">
            <span className="pad-scene3d-legend__marker" aria-hidden>
              <span className="pad-scene3d-legend__swatch pad-scene3d-legend__swatch--sf-warn pad-scene3d-legend__swatch--line" />
            </span>
            <span className="pad-scene3d-legend__text">
              {compact
                ? `SF < ${sfWarningThreshold}`
                : `Нарушение SF (ниже порога ${sfWarningThreshold})`}
            </span>
          </li>
          <li className="pad-scene3d-legend__item">
            <span className="pad-scene3d-legend__marker" aria-hidden>
              <span className="pad-scene3d-legend__swatch pad-scene3d-legend__swatch--clearance-link pad-scene3d-legend__swatch--line" />
            </span>
            <span className="pad-scene3d-legend__text">
              {compact
                ? `Пары SF${clearanceViolationCount > 0 ? ` · ${clearanceViolationCount}` : ''}`
                : `Ближайший подход пар с нарушением SF${
                    clearanceViolationCount > 0 ? ` (${clearanceViolationCount})` : ''
                  }`}
            </span>
          </li>
        </>
      )}
    </ul>
  );

  return (
    <div
      className={`pad-scene3d-legend${compact ? ' pad-scene3d-legend--overlay' : ''}${canCollapse && !open ? ' pad-scene3d-legend--collapsed' : ''}`}
      aria-label="Легенда 3D-сцены"
    >
      {canCollapse ? (
        <button
          type="button"
          className="pad-scene3d-legend__toggle"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="pad-scene3d-legend__title">Легенда</span>
          <ChevronDown
            size={14}
            className={`pad-scene3d-legend__chevron${open ? ' pad-scene3d-legend__chevron--open' : ''}`}
            aria-hidden
          />
        </button>
      ) : (
        <h4 className="pad-scene3d-legend__title">Легенда</h4>
      )}
      {(!canCollapse || open) && list}
    </div>
  );
}
