import { FileBox, Pencil, Trash2 } from 'lucide-react';
import type { Map3dCustomModel } from '../../lib/api';
import { formatImport3dFileSize } from './formatBytes';
import { formatImport3dDate } from './formatDate';

export function map3dModelLabel(m: Map3dCustomModel): string {
  return (m.display_name || m.filename).trim() || m.filename;
}

export function ModelsList({
  models,
  modelsLoading,
  assignedSubtypes,
  canDelete,
  canEdit,
  onDelete,
  onEdit,
  deletePending,
  emptyHint,
}: {
  models: Map3dCustomModel[];
  modelsLoading: boolean;
  assignedSubtypes: (m: Map3dCustomModel) => string[];
  canDelete: boolean;
  canEdit: boolean;
  onDelete: (m: Map3dCustomModel) => void;
  onEdit: (m: Map3dCustomModel) => void;
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

  const showActions = canDelete || canEdit;

  return (
    <div className="import-3d-models-section">
      <table className="import-3d-models-table">
        <thead>
          <tr>
            <th scope="col">Имя</th>
            <th scope="col">Размер</th>
            <th scope="col">Высота</th>
            <th scope="col">Использ.</th>
            <th scope="col">Подтип</th>
            <th scope="col">Загружен</th>
            {showActions ? <th scope="col" className="import-3d-models-table__actions" /> : null}
          </tr>
        </thead>
        <tbody>
          {models.map((m) => {
            const subtypes = assignedSubtypes(m);
            const label = map3dModelLabel(m);
            return (
              <tr key={m.id}>
                <td className="import-3d-models-table__file" title={m.filename}>
                  {label}
                </td>
                <td className="import-3d-models-table__size">{formatImport3dFileSize(m.file_size_bytes)}</td>
                <td className="import-3d-models-table__height">{m.target_height_m} м</td>
                <td className="import-3d-models-table__usage">{m.usage_count ?? 0}</td>
                <td className="import-3d-models-table__subtypes">
                  {subtypes.length === 0 ? (
                    <span className="import-3d-badge import-3d-badge--free">—</span>
                  ) : (
                    subtypes.map((st) => (
                      <span key={st} className="import-3d-badge import-3d-badge--assigned">
                        {st}
                      </span>
                    ))
                  )}
                </td>
                <td className="import-3d-models-table__date">{formatImport3dDate(m.created_at)}</td>
                {showActions ? (
                  <td className="import-3d-models-table__actions">
                    {canEdit ? (
                      <button
                        type="button"
                        className="import-3d-models-table__edit"
                        title="Изменить имя и высоту"
                        aria-label={`Изменить ${label}`}
                        onClick={() => onEdit(m)}
                      >
                        <Pencil size={15} aria-hidden />
                      </button>
                    ) : null}
                    {canDelete ? (
                      <button
                        type="button"
                        className="import-3d-models-table__delete"
                        title="Удалить модель"
                        aria-label={`Удалить ${label}`}
                        disabled={deletePending}
                        onClick={() => onDelete(m)}
                      >
                        <Trash2 size={15} aria-hidden />
                      </button>
                    ) : null}
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
