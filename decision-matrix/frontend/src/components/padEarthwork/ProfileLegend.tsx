export function ProfileLegend({ envelopeActive = false }: { envelopeActive?: boolean }) {
  return (
    <div className="profile-sketch-legend" aria-label="Обозначения профиля">
      <div className="profile-sketch-legend__swatches">
        <span className="profile-sketch-legend__swatch profile-sketch-legend__swatch--terrain">
          Рельеф
        </span>
        <span className="profile-sketch-legend__swatch profile-sketch-legend__swatch--design">
          Проект
        </span>
        {envelopeActive && (
          <span className="profile-sketch-legend__swatch profile-sketch-legend__swatch--envelope">
            Обволование
          </span>
        )}
        <span className="profile-sketch-legend__swatch profile-sketch-legend__swatch--fill">
          Насыпь
        </span>
        <span className="profile-sketch-legend__swatch profile-sketch-legend__swatch--cut">
          Выемка
        </span>
      </div>
      <p className="object-detail-panel__hint text-xs profile-sketch-legend__hint">
        Перетаскивайте точки рельефа и синюю линию проектной отметки. Space + drag или средняя
        кнопка мыши — панорама; колёсико — масштаб.
        {envelopeActive &&
          ' Обволование — трапеция на торцах: подошва W на проектной отметке, бровка на +H, H = (W−TW)/2.'}
      </p>
    </div>
  );
}
