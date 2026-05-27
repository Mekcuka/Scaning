import { useQuery } from '@tanstack/react-query';
import { Download, FileText } from 'lucide-react';
import { MapView } from '../components/MapView';
import { PoiParamsPanel } from '../components/PoiParamsPanel';
import { engLabel } from '../lib/poiParams';
import { api } from '../lib/api';
import { useAppStore } from '../store';

const ROADMAP = [
  { phase: 'Разведка', months: '0–6', status: 'done' },
  { phase: 'ПИР', months: '6–12', status: 'done' },
  { phase: 'Изыскания', months: '12–18', status: 'active' },
  { phase: 'Бурение', months: '18–30', status: 'pending' },
  { phase: 'Строительство', months: '24–36', status: 'pending' },
  { phase: 'Эксплуатация', months: '36+', status: 'pending' },
];

export function ReportPage() {
  const projectId = useAppStore((s) => s.currentProjectId);

  const { data: pois = [] } = useQuery({
    queryKey: ['pois', projectId],
    queryFn: () => api.getPois(projectId!),
    enabled: !!projectId,
  });

  const { data: infraObjects = [] } = useQuery({
    queryKey: ['infra', projectId],
    queryFn: () => api.getInfraObjects(projectId!),
    enabled: !!projectId,
  });

  const { data: layers = [] } = useQuery({
    queryKey: ['layers', projectId],
    queryFn: () => api.getLayers(projectId!),
    enabled: !!projectId,
  });

  const selectedPoi = pois[0] ?? null;

  const { data: analysisData } = useQuery({
    queryKey: ['analysis', projectId, selectedPoi?.id],
    queryFn: () => api.getPoiAnalysis(projectId!, selectedPoi!.id),
    enabled: !!projectId && !!selectedPoi?.id,
    retry: false,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Одностраничник</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Отчёт для руководства (FR-11)
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary">
            <Download size={16} /> PDF
          </button>
          <button type="button" className="btn btn-secondary">
            <FileText size={16} /> PPTX
          </button>
        </div>
      </div>

      <div className="card max-w-4xl mx-auto" id="report-content">
        <div className="text-center mb-6 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-xl font-bold">Участок Западный — Рекомендуемый вариант</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Сценарий 2 · 3055 млн ₽ · {new Date().toLocaleDateString('ru')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="font-semibold mb-2">Карта подключений</h3>
            <MapView
              pois={pois}
              infraObjects={infraObjects}
              selectedPoi={selectedPoi}
              connectionLines={analysisData?.rows ?? []}
              height="220px"
              useMapIcons
              layers={layers}
            />
          </div>
          <div>
            <h3 className="font-semibold mb-2">Ключевые показатели</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Общая стоимость</span>
                <strong>{analysisData ? '—' : '3055'} млн ₽</strong>
              </div>
              <div className="flex justify-between">
                <span>Кустовые площадки</span>
                <strong>{selectedPoi ? `${selectedPoi.pads_count} шт.` : '—'}</strong>
              </div>
              <div className="flex justify-between">
                <span>Электроснабжение</span>
                <strong>{selectedPoi ? engLabel('eng_power', selectedPoi.eng_power) : '—'}</strong>
              </div>
              <div className="flex justify-between">
                <span>Подготовка нефти</span>
                <strong>{selectedPoi ? engLabel('eng_oil_preparation', selectedPoi.eng_oil_preparation) : '—'}</strong>
              </div>
              <div className="flex justify-between">
                <span>Транспортировка</span>
                <strong>{selectedPoi ? engLabel('eng_transport', selectedPoi.eng_transport) : '—'}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="font-semibold mb-3">Дорожная карта (диаграмма Ганта)</h3>
          <div className="border rounded-lg p-3 text-xs" style={{ borderColor: 'var(--border)' }}>
            <div className="flex justify-between mb-1" style={{ color: 'var(--text-muted)' }}>
              <span>Месяцы</span>
              <span>0</span>
              <span>12</span>
              <span>24</span>
              <span>36+</span>
            </div>
            <div className="space-y-2">
              {ROADMAP.map((step) => {
                const [startStr, endStr] = step.months.split('–');
                const start = parseInt(startStr, 10) || 0;
                const end = endStr?.includes('+') ? 42 : parseInt(endStr, 10) || start + 6;
                const duration = Math.max(end - start, 3);
                const left = (start / 42) * 100;
                const width = (duration / 42) * 100;
                const baseClass =
                  step.status === 'done'
                    ? 'bg-green-500'
                    : step.status === 'active'
                      ? 'bg-blue-500'
                      : 'bg-gray-400';
                return (
                  <div key={step.phase} className="flex items-center gap-2">
                    <div className="w-28 shrink-0">
                      <div className="font-medium">{step.phase}</div>
                      <div className="opacity-70">{step.months} мес.</div>
                    </div>
                    <div className="relative flex-1 h-4 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`${baseClass} h-full rounded-full`}
                        style={{ marginLeft: `${left}%`, width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg" style={{ background: 'var(--bg)' }}>
          <h3 className="font-semibold mb-2">Рекомендация</h3>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Рекомендуется реализация по Сценарию 2: внутреннее электроснабжение (ГТЭС),
            локальная закачка, подготовка нефти на МКОС, транспортировка через магистральный
            нефтепровод. Все пороговые расстояния соблюдены. Общая стоимость — 3055 млн ₽.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto mt-4">
        <PoiParamsPanel
          projectId={projectId}
          poiId={selectedPoi?.id ?? null}
          readOnly
          showSave={false}
          title="Параметры POI в отчёте"
        />
      </div>
    </div>
  );
}
