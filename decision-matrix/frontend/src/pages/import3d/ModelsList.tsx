import { useMemo } from 'react';
import { FileBox, Pencil, Trash2 } from 'lucide-react';
import { Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Map3dCustomModel } from '../../lib/api';
import { AppDataTable } from '../../components/AppDataTable';
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
  const showActions = canDelete || canEdit;

  const columns = useMemo<ColumnsType<Map3dCustomModel>>(() => {
    const cols: ColumnsType<Map3dCustomModel> = [
      {
        title: 'Имя',
        key: 'name',
        className: 'import-3d-models-table__file',
        render: (_, m) => (
          <span title={m.filename}>{map3dModelLabel(m)}</span>
        ),
      },
      {
        title: 'Размер',
        key: 'size',
        className: 'import-3d-models-table__size',
        render: (_, m) => formatImport3dFileSize(m.file_size_bytes),
      },
      {
        title: 'Высота',
        key: 'height',
        className: 'import-3d-models-table__height',
        render: (_, m) => `${m.target_height_m} м`,
      },
      {
        title: 'Использ.',
        dataIndex: 'usage_count',
        key: 'usage',
        className: 'import-3d-models-table__usage',
        render: (count) => (typeof count === 'number' ? count : 0),
      },
      {
        title: 'Подтип',
        key: 'subtypes',
        className: 'import-3d-models-table__subtypes',
        render: (_, m) => {
          const subtypes = assignedSubtypes(m);
          if (subtypes.length === 0) {
            return <span className="import-3d-badge import-3d-badge--free">—</span>;
          }
          return subtypes.map((st) => (
            <span key={st} className="import-3d-badge import-3d-badge--assigned">
              {st}
            </span>
          ));
        },
      },
      {
        title: 'Загружен',
        key: 'created_at',
        className: 'import-3d-models-table__date',
        render: (_, m) => formatImport3dDate(m.created_at),
      },
    ];
    if (showActions) {
      cols.push({
        title: '',
        key: 'actions',
        className: 'import-3d-models-table__actions',
        render: (_, m) => {
          const label = map3dModelLabel(m);
          return (
            <>
              {canEdit ? (
                <Button
                  type="text"
                  size="small"
                  className="import-3d-models-table__edit"
                  title="Изменить имя и высоту"
                  aria-label={`Изменить ${label}`}
                  icon={<Pencil size={15} aria-hidden />}
                  onClick={() => onEdit(m)}
                />
              ) : null}
              {canDelete ? (
                <Button
                  type="text"
                  size="small"
                  className="import-3d-models-table__delete"
                  title="Удалить модель"
                  aria-label={`Удалить ${label}`}
                  disabled={deletePending}
                  icon={<Trash2 size={15} aria-hidden />}
                  onClick={() => onDelete(m)}
                />
              ) : null}
            </>
          );
        },
      });
    }
    return cols;
  }, [assignedSubtypes, canDelete, canEdit, deletePending, onDelete, onEdit, showActions]);

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
      <AppDataTable
        className="import-3d-models-table"
        rowKey="id"
        columns={columns}
        dataSource={models}
      />
    </div>
  );
}
