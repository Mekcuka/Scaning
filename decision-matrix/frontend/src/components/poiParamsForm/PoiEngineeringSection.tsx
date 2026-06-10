import { EngBadgeGroup } from '../EngBadgeGroup';
import { ENG_PARAM_GROUPS } from '../../lib/poiParams';
import type { PoiSectionCommonProps } from './types';

export function PoiEngineeringSection({
  value,
  patch,
  readOnly,
  flat,
}: PoiSectionCommonProps & { flat?: boolean }) {
  return (
    <div className={flat ? 'poi-params-form__eng-grid' : 'flex flex-wrap gap-4'}>
      {ENG_PARAM_GROUPS.map((g) => (
        <EngBadgeGroup
          key={g.key}
          label={g.label}
          badgeClass={g.badgeClass}
          options={[...g.options]}
          value={value[g.key]}
          readOnly={readOnly}
          onChange={(v) => patch({ [g.key]: v })}
        />
      ))}
    </div>
  );
}
