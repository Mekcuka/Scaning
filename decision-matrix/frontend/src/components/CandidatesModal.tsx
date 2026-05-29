import { useQuery } from '@tanstack/react-query';
import { api, SUBTYPE_LABELS, type Candidate } from '../lib/api';
import { AppModal } from './AppModal';

interface CandidatesModalProps {
  projectId: string;
  poiId: string;
  subtype: string;
  paramType?: 'external' | 'external_linear';
  onClose: () => void;
  onSelect: (candidate: Candidate) => void;
}

export function CandidatesModal({
  projectId,
  poiId,
  subtype,
  paramType = 'external',
  onClose,
  onSelect,
}: CandidatesModalProps) {
  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ['candidates', projectId, poiId, subtype, paramType],
    queryFn: () => api.getCandidates(projectId, poiId, subtype, 20, paramType),
  });

  return (
    <AppModal title={`Выбор: ${SUBTYPE_LABELS[subtype] || subtype}`} onClose={onClose} size="sm">
      {isLoading && <p className="text-sm">Загрузка...</p>}
      {!isLoading && candidates.length === 0 && (
        <p className="text-sm text-[var(--text-muted)]">Кандидаты не найдены</p>
      )}
      <ul className="flex flex-col gap-1">
        {candidates.map((c) => (
          <li key={c.object_id}>
            <button
              type="button"
              className="app-touch-row w-full text-left px-3 py-2.5 rounded-lg hover:bg-[var(--bg)] text-sm"
              onClick={() => onSelect(c)}
            >
              <span className="font-medium">{c.name}</span>
              <span className="text-[var(--text-muted)] ml-2">
                {c.distance_km} км
                {c.anchor_type === 'network_node' ? ' · узел' : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </AppModal>
  );
}
