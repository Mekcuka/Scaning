import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { api, SUBTYPE_LABELS, type Candidate } from '../lib/api';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-[var(--surface)] rounded-xl shadow-lg max-w-md w-full max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-medium">Выбор: {SUBTYPE_LABELS[subtype] || subtype}</h2>
          <button type="button" onClick={onClose} className="p-1">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-auto p-2">
          {isLoading && <p className="text-sm p-2">Загрузка...</p>}
          {!isLoading && candidates.length === 0 && (
            <p className="text-sm p-2 text-[var(--text-muted)]">Кандидаты не найдены</p>
          )}
          <ul className="flex flex-col gap-1">
            {candidates.map((c) => (
              <li key={c.object_id}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--bg)] text-sm"
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
        </div>
      </div>
    </div>
  );
}
