import { FileBox, Trash2 } from 'lucide-react';
import type { Map3dCustomModel } from '../../lib/api';
import { formatImport3dDate } from './formatDate';

export function ModelsList({
  models,
  modelsLoading,
  assignedSubtypes,
  canDelete,
  onDelete,
  deletePending,
  emptyHint,
}: {
  models: Map3dCustomModel[];
  modelsLoading: boolean;
  assignedSubtypes: (m: Map3dCustomModel) => string[];
  canDelete: boolean;
  onDelete: (id: string) => void;
  deletePending: boolean;
  emptyHint: string;
}) {
  if (modelsLoading) {
    return <p className="import-3d-muted import-3d-models-section__loading">Загрузка списка…</p>;
  }

  if (models.length === 0) {
    return (
      <div className="import-3d-empty import-3d-empty--compact import-3d-empty--inline">
        <FileBox size={28} strokeWidth={1.25} aria-hidden />
        <div>
          <p className="import-3d-empty__title">Моделей пока нет</p>
          <p className="import-3d-empty__hint">{emptyHint}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="import-3d-models-section">
      <table className="import-3d-models-table">
        <thead>
          <tr>
            <th scope="col">Файл</th>
            <th scope="col">Подтип</th>
            <th scope="col">Загружен</th>
            {canDelete ? <th scope="col" className="import-3d-models-table__actions" /> : null}
          </tr>
        </thead>
        <tbody>
          {models.map((m) => {
            const subtypes = assignedSubtypes(m);
            return (
              <tr key={m.id}>
                <td className="import-3d-models-table__file" title={m.filename}>
                  {m.filename}
                </td>
                <td className="import-3d-models-table__subtypes">
                  {subtypes.length === 0 ? (
                    <span className="import-3d-badge import-3d-badge--free">—</span>
                  ) : (
                    subtypes.map((label) => (
                      <span key={label} className="import-3d-badge import-3d-badge--assigned">
                        {label}
                      </span>
                    ))
                  )}
                </td>
                <td className="import-3d-models-table__date">{formatImport3dDate(m.created_at)}</td>
                {canDelete ? (
                  <td className="import-3d-models-table__actions">
                    <button
                      type="button"
                      className="import-3d-models-table__delete"
                      title="Удалить модель"
                      aria-label={`Удалить ${m.filename}`}
                      disabled={deletePending}
                      onClick={() => onDelete(m.id)}
                    >
                      <Trash2 size={15} aria-hidden />
                    </button>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
