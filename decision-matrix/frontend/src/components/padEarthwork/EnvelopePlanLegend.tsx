export function EnvelopePlanLegend() {
  return (
    <div className="envelope-plan-legend">
      <h4 className="envelope-plan-legend__title">Обволование на плане</h4>
      <ul className="envelope-plan-legend__list">
        <li>
          <span className="envelope-plan-legend__swatch envelope-plan-legend__swatch--pad" aria-hidden />
          Контур площадки — внешний край подошвы забора
        </li>
        <li>
          <span className="envelope-plan-legend__swatch envelope-plan-legend__swatch--ring" aria-hidden />
          Кольцо — подошва забора (ширина W на верху насыпи)
        </li>
        <li>
          <span
            className="envelope-plan-legend__swatch envelope-plan-legend__swatch--outer-crest"
            aria-hidden
          />
          Светлый пунктир — внешняя бровка (inset H)
        </li>
        <li>
          <span
            className="envelope-plan-legend__swatch envelope-plan-legend__swatch--inner-crest"
            aria-hidden
          />
          Тёмный пунктир — внутренняя бровка (inset (W+TW)/2)
        </li>
      </ul>
      <p className="object-detail-panel__hint text-xs">
        Забор на верху насыпи: откосы 1:1, TW = W/3, высота бровки H = (W−TW)/2.
      </p>
    </div>
  );
}
