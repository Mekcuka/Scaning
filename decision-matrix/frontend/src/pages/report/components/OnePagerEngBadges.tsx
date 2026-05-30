import { ENG_PARAM_GROUPS, engLabel } from '../../../lib/poiParams';
import type { POI } from '../../../lib/api';

type Props = {
  poi: POI | null;
  equipmentCostMln?: number | null;
};

export function OnePagerEngBadges({ poi, equipmentCostMln }: Props) {
  if (!poi) return null;

  return (
    <div className="one-pager-eng">
      <h4 className="one-pager-subheading">Инженерные параметры</h4>
      <div className="one-pager-badges">
        {ENG_PARAM_GROUPS.map((g) => (
          <span key={g.key} className={`eng-badge ${g.badgeClass} active`}>
            {engLabel(g.key, String(poi[g.key] ?? ''))}
          </span>
        ))}
      </div>
      {equipmentCostMln != null && (
        <p className="one-pager-eng-cost text-sm mt-2">
          Стоимость инженерного оборудования: <strong>{equipmentCostMln} млн ₽</strong>
        </p>
      )}
    </div>
  );
}
