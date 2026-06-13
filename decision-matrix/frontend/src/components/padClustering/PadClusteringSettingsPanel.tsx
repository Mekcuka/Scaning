import type { ReactNode } from 'react';
import { Grid3x3, Layers, Settings2 } from 'lucide-react';
import { PlanGeneratorPanel } from '../padEarthwork/PlanGeneratorPanel';
import { PadClusteringCollapsibleSection } from './PadClusteringCollapsibleSection';
import type { PadClusteringPadDraft } from '../../lib/padClusteringSave';
import type { usePadClusteringEditor } from '../../hooks/usePadClusteringEditor';

type Editor = ReturnType<typeof usePadClusteringEditor>;

interface PadClusteringSettingsPanelProps {
  readOnly: boolean;
  draft: PadClusteringPadDraft;
  patchDraft: (patch: Partial<PadClusteringPadDraft>) => void;
  wellsLocalCount: number;
  kbM: number;
  generateAndSaveMut: Editor['generateAndSaveMut'];
  trajectorySection: ReactNode;
  bottomholesSection: ReactNode;
}

function SectionBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'ok' | 'warn' }) {
  return (
    <span className={`pad-clustering-badge pad-clustering-badge--${tone}`}>{children}</span>
  );
}

export function PadClusteringSettingsPanel({
  readOnly,
  draft,
  patchDraft,
  wellsLocalCount,
  kbM,
  generateAndSaveMut,
  trajectorySection,
  bottomholesSection,
}: PadClusteringSettingsPanelProps) {
  return (
    <div className="pad-clustering-settings">
      <div className="pad-clustering-settings__header">
        <Settings2 size={16} aria-hidden />
        <span>Параметры куста</span>
      </div>
      <PadClusteringCollapsibleSection
        id="pad-clustering-section-layout"
        title="Раскладка устьев"
        icon={<Grid3x3 size={15} strokeWidth={2} aria-hidden />}
        badge={
          <SectionBadge tone={wellsLocalCount > 0 ? 'ok' : 'warn'}>
            {wellsLocalCount > 0 ? `${wellsLocalCount} уст.` : 'нет схемы'}
          </SectionBadge>
        }
        hint="Число скважин, шаги и отступы — вход для координат устьев и траекторий."
        defaultOpen
      >
        <PlanGeneratorPanel
          readOnly={readOnly}
          padWellCount={draft.padWellCount}
          setPadWellCount={(value) => patchDraft({ padWellCount: value })}
          padWellsPerGroup={draft.padWellsPerGroup}
          setPadWellsPerGroup={(value) => patchDraft({ padWellsPerGroup: value })}
          padWellSpacingM={draft.padWellSpacingM}
          setPadWellSpacingM={(value) => patchDraft({ padWellSpacingM: value })}
          padGroupSpacingM={draft.padGroupSpacingM}
          setPadGroupSpacingM={(value) => patchDraft({ padGroupSpacingM: value })}
          padMarginLeftM={draft.padMarginLeftM}
          setPadMarginLeftM={(value) => patchDraft({ padMarginLeftM: value })}
          padMarginBottomM={draft.padMarginBottomM}
          setPadMarginBottomM={(value) => patchDraft({ padMarginBottomM: value })}
          padMarginTopM={draft.padMarginTopM}
          setPadMarginTopM={(value) => patchDraft({ padMarginTopM: value })}
          padMarginEndM={draft.padMarginEndM}
          setPadMarginEndM={(value) => patchDraft({ padMarginEndM: value })}
          rotationDeg={draft.rotationDeg}
          setRotationDeg={(value) => patchDraft({ rotationDeg: value })}
          generating={generateAndSaveMut.isPending}
          onGenerate={() => generateAndSaveMut.mutate()}
          hasPreview={wellsLocalCount > 0}
          wellCountOnCanvas={wellsLocalCount}
        />
      </PadClusteringCollapsibleSection>

      <PadClusteringCollapsibleSection
        id="pad-clustering-section-pad"
        title="Площадка (KB устья)"
        icon={<Layers size={15} strokeWidth={2} aria-hidden />}
        badge={
          <SectionBadge tone="neutral">
            KB {kbM.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} м
          </SectionBadge>
        }
        hint="Опорная отметка + высота насыпи задают стартовую точку ствола. НДС — в блоке «Раскладка устьев»."
        defaultOpen
      >
        <div className="pad-clustering-field-grid">
          <label className="pad-clustering-field">
            <span>Длина, м</span>
            <input
              className="input"
              type="number"
              min={0}
              step="any"
              value={draft.lengthM}
              readOnly={readOnly}
              disabled={readOnly}
              onChange={(e) => patchDraft({ lengthM: e.target.value })}
            />
          </label>
          <label className="pad-clustering-field">
            <span>Ширина, м</span>
            <input
              className="input"
              type="number"
              min={0}
              step="any"
              value={draft.widthM}
              readOnly={readOnly}
              disabled={readOnly}
              onChange={(e) => patchDraft({ widthM: e.target.value })}
            />
          </label>
          <label className="pad-clustering-field">
            <span>Высота насыпи, м</span>
            <input
              className="input"
              type="number"
              min={0}
              step="any"
              value={draft.heightM}
              readOnly={readOnly}
              disabled={readOnly}
              onChange={(e) => patchDraft({ heightM: e.target.value })}
            />
          </label>
          <label className="pad-clustering-field">
            <span>Опорная отметка, м</span>
            <input
              className="input"
              type="number"
              step="any"
              value={draft.referenceElevationM}
              readOnly={readOnly}
              disabled={readOnly}
              onChange={(e) => patchDraft({ referenceElevationM: e.target.value })}
            />
          </label>
        </div>
      </PadClusteringCollapsibleSection>

      {trajectorySection}
      {bottomholesSection}
    </div>
  );
}
