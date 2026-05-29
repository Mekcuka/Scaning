import { FlowSchematicEditor } from '../../components/FlowSchematicEditor';
import { FLUID_COLORS, FLUID_LABELS, WARNING_LABELS } from '../../lib/flowSchematic';
import { useFlowSchematicContext } from './flowSchematicContext';

export function FlowTechnologyPage() {
  const {
    pois,
    activePoiId,
    schematicQuery,
    schematicEditorKey,
    saveMut,
    persistSchematicMut,
    poiProductionMut,
    resetMut,
  } = useFlowSchematicContext();

  const schematic = schematicQuery.data;
  const schematicLoading = schematicQuery.isLoading;
  const isError = schematicQuery.isError;
  const error = schematicQuery.error;

  return (
    <section className="card p-4 flow-schematic-window">
      <p className="flow-schematic-window-subtitle text-sm text-[var(--text-muted)] mb-4">
        PFD: редактирование, рисование связей и сохранение схемы
      </p>

      <div className="flex flex-wrap gap-4 text-sm mb-4">
        {(['oil', 'water', 'gas'] as const).map((f) => (
          <span key={f} className="inline-flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ background: FLUID_COLORS[f] }}
            />
            {FLUID_LABELS[f]}
          </span>
        ))}
        {schematic?.source === 'custom' && (
          <span className="text-[var(--accent)] font-medium">Пользовательская схема</span>
        )}
      </div>

      {schematicLoading && (
        <p className="text-[var(--text-muted)] py-12 text-center">Загрузка схемы…</p>
      )}
      {isError && (
        <p className="text-red-600 py-8 text-center">
          {error instanceof Error ? error.message : 'Не удалось загрузить схему'}
        </p>
      )}
      {schematic && !schematicLoading && (
        <FlowSchematicEditor
          key={schematicEditorKey}
          schematic={schematic}
          poi={pois.find((p) => p.id === activePoiId) ?? null}
          onSave={(dto) => saveMut.mutate(dto)}
          onPersistCapacity={(dto) => persistSchematicMut.mutate(dto)}
          onPlannedProductionChange={(volume) => poiProductionMut.mutate(volume)}
          onReset={() => resetMut.mutate()}
          saving={saveMut.isPending}
          resetting={resetMut.isPending}
          canvasHeightClass="h-[min(58vh,520px)]"
        />
      )}

      {schematic && !schematicLoading && (
        <p className="text-xs text-[var(--text-muted)] mt-3">
          {schematic.source === 'custom'
            ? 'Сохранена пользовательская схема. «Сброс» удалит правки и пересчитает схему по POI и сети.'
            : '«Пересчитать» обновит схему после изменения параметров POI или инфраструктуры на карте.'}
        </p>
      )}

      {schematic && schematic.warnings.length > 0 && (
        <ul className="text-sm text-[var(--text-muted)] space-y-1 list-disc pl-5 mt-4">
          {schematic.warnings
            .filter((w) => w !== 'network_not_built')
            .map((w) => (
              <li key={w}>{WARNING_LABELS[w] ?? w}</li>
            ))}
        </ul>
      )}
    </section>
  );
}
