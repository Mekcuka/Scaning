import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useRankingContext } from '../../pages/ranking/rankingContext';
import { useAppStore } from '../../store';

type Props = {
  kind: 'no-project' | 'no-poi' | 'no-scenarios';
};

export function RankingEmptyState({ kind }: Props) {
  const { projectId, activePoiId, refreshAfterAnalyze, calculate } = useRankingContext();
  const pushToast = useAppStore((s) => s.pushToast);

  const analyzeMut = useMutation({
    mutationFn: async () => {
      await api.analyzePoi(projectId!, activePoiId);
      await refreshAfterAnalyze();
    },
    onSuccess: () => {
      pushToast('success', 'Анализ выполнен — сценарии готовы к ранжированию');
      calculate({ toast: true });
    },
    onError: (err: Error) => pushToast('error', err.message || 'Не удалось выполнить анализ'),
  });

  if (kind === 'no-project') {
    return (
      <div className="card ranking-empty">
        <p>Выберите проект в шапке приложения.</p>
      </div>
    );
  }

  if (kind === 'no-poi') {
    return (
      <div className="card ranking-empty">
        <p>Нет точек интереса. Добавьте POI на карте или в проекте.</p>
        <Link to="/map" className="btn btn-primary btn-sm mt-3">
          Перейти к карте
        </Link>
      </div>
    );
  }

  return (
    <div className="card ranking-empty">
      <p>Для выбранной точки нет сценариев. Запустите анализ окружения или нажмите «Рассчитать» — сценарии будут созданы из уже выполненного анализа.</p>
      <div className="flex gap-2 mt-3 flex-wrap">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!projectId || !activePoiId || analyzeMut.isPending}
          onClick={() => analyzeMut.mutate()}
        >
          {analyzeMut.isPending ? 'Анализ…' : 'Запустить анализ'}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!projectId || !activePoiId}
          onClick={() => calculate({ toast: true })}
        >
          Рассчитать
        </button>
        <Link to="/matrix" className="btn btn-secondary btn-sm">
          Матрица сценариев
        </Link>
      </div>
    </div>
  );
}
