import { EconomicFlowSchematic } from '../../components/EconomicFlowSchematic';
import { useFlowSchematicContext } from './flowSchematicContext';

export function FlowEconomicPage() {
  const { schematicQuery, economicQuery } = useFlowSchematicContext();

  const schematic = schematicQuery.data;
  const schematicLoading = schematicQuery.isLoading;
  const isError = schematicQuery.isError;

  const economicSchematic = economicQuery.data;
  const economicLoading = economicQuery.isLoading;
  const economicError = economicQuery.isError;
  const economicErr = economicQuery.error;

  return (
    <section className="card p-4 flow-schematic-window">
      <p className="flow-schematic-window-subtitle text-sm text-[var(--text-muted)] mb-4">
        Денежные потоки по цепочке технологической схемы
      </p>

      {schematicLoading || economicLoading ? (
        <p className="text-[var(--text-muted)] py-12 text-center">Загрузка…</p>
      ) : economicError ? (
        <p className="text-red-600 py-8 text-center">
          {economicErr instanceof Error
            ? economicErr.message
            : 'Не удалось загрузить экономическую схему'}
        </p>
      ) : economicSchematic ? (
        <EconomicFlowSchematic schematic={economicSchematic} />
      ) : schematic && !isError ? (
        <p className="text-[var(--text-muted)] py-12 text-center">
          Экономическая схема будет доступна после загрузки технологического потока.
        </p>
      ) : (
        <p className="text-[var(--text-muted)] py-12 text-center">
          Экономическая схема будет доступна после загрузки технологического потока.
        </p>
      )}
    </section>
  );
}
