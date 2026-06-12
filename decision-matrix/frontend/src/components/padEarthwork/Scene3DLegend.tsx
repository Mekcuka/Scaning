export type Scene3DLegendProps = {
  demActive: boolean;
  envelopeActive: boolean;
};

export function Scene3DLegend({ demActive, envelopeActive }: Scene3DLegendProps) {
  return (
    <div className="pad-scene3d-legend">
      <h4 className="pad-scene3d-legend__title">Легенда</h4>
      <ul className="pad-scene3d-legend__list">
        <li>
          <span
            className={`pad-scene3d-legend__swatch pad-scene3d-legend__swatch--terrain${demActive ? '' : ' pad-scene3d-legend__swatch--muted'}`}
            aria-hidden
          />
          {demActive ? 'Рельеф DEM (сетка preview)' : 'Плоскость на опорной отметке'}
        </li>
        <li>
          <span className="pad-scene3d-legend__swatch pad-scene3d-legend__swatch--pad" aria-hidden />
          Призма площадки
        </li>
        {envelopeActive && (
          <li>
            <span
              className="pad-scene3d-legend__swatch pad-scene3d-legend__swatch--envelope"
              aria-hidden
            />
            Обволование — кольцо-забор на верху насыпи (откосы 1:1, бровка на H = (W−TW)/2)
          </li>
        )}
      </ul>
    </div>
  );
}
