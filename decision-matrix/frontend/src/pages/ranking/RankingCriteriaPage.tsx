import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { RankingEmptyState } from '../../components/ranking/RankingEmptyState';
import { RankingExpertDefaultsModal } from '../../components/ranking/RankingExpertDefaultsModal';
import { RankingWeightsEditor } from '../../components/ranking/RankingWeightsEditor';
import { RankingAhpPanel } from '../../components/ranking/RankingAhpPanel';
import { RankingExpertMatrix } from '../../components/ranking/RankingExpertMatrix';
import { RankingComputedMatrix } from '../../components/ranking/RankingComputedMatrix';
import { RANKING_DEFAULT_EXPERT, type RankingCriterion } from '../../lib/api';
import { useRankingContext } from './rankingContext';
import { useAppStore } from '../../store';

export function RankingCriteriaPage() {
  const {
    projectId,
    pois,
    poiScenarios,
    rankingSettings,
    matrix,
    matrixLoading,
    updateSettings,
    settingsSaving,
    calculate,
  } = useRankingContext();
  const pushToast = useAppStore((s) => s.pushToast);
  const [weightMode, setWeightMode] = useState<'manual' | 'ahp'>('manual');
  const [showAdd, setShowAdd] = useState(false);
  const [defaultsModalOpen, setDefaultsModalOpen] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'cost' | 'benefit'>('cost');
  const [newSource, setNewSource] = useState<'user' | 'computed'>('user');

  if (!projectId) return <RankingEmptyState kind="no-project" />;
  if (pois.length === 0) return <RankingEmptyState kind="no-poi" />;

  const criteria = rankingSettings?.criteria ?? [];
  const weights = rankingSettings?.weights ?? {};
  const defaults = rankingSettings?.default_expert_values ?? RANKING_DEFAULT_EXPERT;
  const hasScenarios = poiScenarios.length > 0;

  const addCriterion = async () => {
    const id = newId.trim().replace(/\s+/g, '_');
    if (!id || !newName.trim()) {
      pushToast('error', 'Укажите id и название критерия');
      return;
    }
    if (criteria.some((c) => c.id === id)) {
      pushToast('error', 'Критерий с таким id уже есть');
      return;
    }
    const next: RankingCriterion = {
      id,
      name: newName.trim(),
      type: newType,
      value_source: newSource,
    };
    const nextCriteria = [...criteria, next];
    const n = nextCriteria.length;
    const equal = 1 / n;
    const nextWeights = Object.fromEntries(nextCriteria.map((c) => [c.id, equal]));
    await updateSettings({ criteria: nextCriteria, weights: nextWeights });
    setShowAdd(false);
    setNewId('');
    setNewName('');
    pushToast('success', 'Критерий добавлен');
  };

  const removeCriterion = async (id: string) => {
    if (criteria.length <= 2) {
      pushToast('error', 'Минимум 2 критерия');
      return;
    }
    const presetComputed = ['total_cost_mln', 'total_distance_km', 'exceed_count'];
    if (presetComputed.includes(id)) {
      pushToast('error', 'Предустановленные computed-критерии нельзя удалить');
      return;
    }
    const nextCriteria = criteria.filter((c) => c.id !== id);
    const n = nextCriteria.length;
    const equal = 1 / n;
    const nextWeights = Object.fromEntries(nextCriteria.map((c) => [c.id, equal]));
    await updateSettings({ criteria: nextCriteria, weights: nextWeights });
    pushToast('success', 'Критерий удалён');
  };

  const applyDefaults = async (values: typeof defaults) => {
    await updateSettings({ default_expert_values: values });
    calculate();
    setDefaultsModalOpen(false);
    pushToast('success', 'Дефолты сохранены');
  };

  return (
    <div className="ranking-criteria">
      {!hasScenarios && <RankingEmptyState kind="no-scenarios" />}

      <h2 className="ranking-tab-title">Критерии и веса</h2>
      <div className="card mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="font-semibold">Веса критериев</h2>
          <div className="ranking-weight-mode">
            <button
              type="button"
              className={`btn btn-sm ${weightMode === 'manual' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setWeightMode('manual')}
            >
              Ручной
            </button>
            <button
              type="button"
              className={`btn btn-sm ${weightMode === 'ahp' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setWeightMode('ahp')}
            >
              AHP
            </button>
          </div>
        </div>
        {weightMode === 'manual' ? (
          <RankingWeightsEditor criteria={criteria} weights={weights} />
        ) : (
          <RankingAhpPanel criteria={criteria} />
        )}
      </div>

      <div className="card mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-semibold">Список критериев</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAdd((v) => !v)}>
            <Plus size={14} className="inline mr-1" />
            Добавить
          </button>
        </div>
        {showAdd && (
          <div className="ranking-add-criterion mb-4 p-3 rounded-lg border" style={{ borderColor: 'var(--border)' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
              <input placeholder="id (латиница)" value={newId} onChange={(e) => setNewId(e.target.value)} />
              <input placeholder="Название" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <select value={newType} onChange={(e) => setNewType(e.target.value as 'cost' | 'benefit')}>
                <option value="cost">Минимизация (cost)</option>
                <option value="benefit">Максимизация (benefit)</option>
              </select>
              <select value={newSource} onChange={(e) => setNewSource(e.target.value as 'user' | 'computed')}>
                <option value="user">Экспертный ввод</option>
                <option value="computed">Вычисляемый</option>
              </select>
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void addCriterion()}>
              Сохранить критерий
            </button>
          </div>
        )}
        <ul className="ranking-criteria-list">
          {criteria.map((c) => (
            <li key={c.id} className="ranking-criteria-list__item">
              <span>
                <strong>{c.name}</strong>
                <span className="text-sm ml-2" style={{ color: 'var(--text-muted)' }}>
                  {c.value_source === 'user' ? 'эксперт' : 'auto'} · {c.type}
                </span>
              </span>
              {!['total_cost_mln', 'total_distance_km', 'exceed_count'].includes(c.id) && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm p-2"
                  title="Удалить"
                  onClick={() => void removeCriterion(c.id)}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="card mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-semibold">Дефолты для пустых экспертных ячеек</h2>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={settingsSaving}
            onClick={() => setDefaultsModalOpen(true)}
          >
            Изменить…
          </button>
        </div>
        <dl className="ranking-defaults-summary grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <dt style={{ color: 'var(--text-muted)' }}>Риск</dt>
            <dd className="font-medium tabular">{defaults.risk ?? 5}</dd>
          </div>
          <div>
            <dt style={{ color: 'var(--text-muted)' }}>Надёжность</dt>
            <dd className="font-medium tabular">{defaults.reliability ?? 5}</dd>
          </div>
          <div>
            <dt style={{ color: 'var(--text-muted)' }}>Время (мес.)</dt>
            <dd className="font-medium tabular">{defaults.time_months ?? 12}</dd>
          </div>
        </dl>
        <RankingExpertDefaultsModal
          open={defaultsModalOpen}
          defaults={defaults}
          saving={settingsSaving}
          onClose={() => setDefaultsModalOpen(false)}
          onApply={applyDefaults}
        />
      </div>

      {matrixLoading && hasScenarios && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Загрузка матрицы…
        </p>
      )}
      {hasScenarios && matrix && (
        <>
          <div className="card mb-4">
            <RankingComputedMatrix matrix={matrix} />
          </div>
          <div className="card">
            <RankingExpertMatrix matrix={matrix} />
          </div>
        </>
      )}
    </div>
  );
}
