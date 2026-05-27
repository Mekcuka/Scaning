import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Save } from 'lucide-react';
import { api } from '../lib/api';
import { useAppStore } from '../store';
import { COST_RATE_GROUPS, buildDefaultRates } from '../lib/specs';
import { ProjectDistanceDefaultsForm } from '../components/ProjectDistanceDefaultsForm';

export function RatesPage() {
  const projectId = useAppStore((s) => s.currentProjectId);
  const qc = useQueryClient();
  const [rates, setRates] = useState<Record<string, number>>(buildDefaultRates());
  const [saved, setSaved] = useState(false);

  const { data } = useQuery({
    queryKey: ['rates', projectId],
    queryFn: () => api.getRates(projectId!),
    enabled: !!projectId,
  });

  useEffect(() => {
    if (data?.rates) setRates(data.rates);
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () => api.updateRates(projectId!, rates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rates', projectId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const handleReset = () => setRates(buildDefaultRates());

  if (!projectId) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Ставки стоимости</h1>
        <div className="card" style={{ color: 'var(--text-muted)' }}>
          Выберите проект на странице «Проекты» для редактирования ставок (16 показателей, тыс. ₽).
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Ставки стоимости</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            16 показателей в тыс. ₽ + параметры расстояний проекта (FR-4.1.2, FR-4.1.5)
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={handleReset}>
            <RotateCcw size={16} /> Сброс
          </button>
          <button type="button" className="btn btn-primary" onClick={() => saveMut.mutate()}>
            <Save size={16} /> {saved ? 'Сохранено!' : 'Сохранить'}
          </button>
        </div>
      </div>

      {COST_RATE_GROUPS.map((group) => (
        <div key={group.id} className="card mb-4">
          <h2 className="font-semibold mb-4">{group.label}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {group.rows.map((row) => (
              <div key={row.id} className="form-group mb-0">
                <label>{row.label} ({group.unitLabel})</label>
                <input
                  type="number"
                  value={rates[row.id] ?? row.defaultValue}
                  onChange={(e) => setRates({ ...rates, [row.id]: +e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <ProjectDistanceDefaultsForm projectId={projectId} />
    </div>
  );
}
