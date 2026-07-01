import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { Button, Space } from 'antd';
import { Trash2 } from 'lucide-react';
import type { Project } from '../lib/api';
import {
  ellipsisText,
  formatProjectDate,
  PROJECT_TABLE_DESC_MAX,
  PROJECT_TABLE_NAME_MAX,
  projectStatus,
} from '../lib/projectDisplay';
import { InlineTableEdit } from './InlineTableEdit';
import { ProjectStatusSelect } from './ProjectStatusSelect';
import { AppDataTable } from './AppDataTable';

type ProjectUpdateHandler = (vars: {
  id: string;
  name?: string;
  description?: string;
  status?: string;
  toastMessage?: string;
}) => void;

type ProjectsDataTableProps = {
  projects: Project[];
  editable?: boolean;
  canWriteProject?: boolean;
  saving?: boolean;
  onUpdate?: ProjectUpdateHandler;
  onOpenProject: (project: Project) => void;
  canDelete?: (project: Project) => boolean;
  onDelete?: (project: Project, e: MouseEvent) => void;
  deletePending?: boolean;
  emptyText?: string;
};

export function buildProjectsTableColumns({
  editable = false,
  canWriteProject = false,
  saving = false,
  onUpdate,
  onOpenProject,
  canDelete,
  onDelete,
  deletePending = false,
}: Omit<ProjectsDataTableProps, 'projects' | 'emptyText'>): ColumnsType<Project> {
  return [
    {
      title: 'Название',
      key: 'name',
      className: 'col-name',
      ellipsis: true,
      render: (_, p) =>
        editable ? (
          <InlineTableEdit
            value={p.name}
            displayText={ellipsisText(p.name, PROJECT_TABLE_NAME_MAX)}
            title={p.name}
            placeholder="Название проекта"
            saving={saving}
            readOnly={!canWriteProject}
            linkTo={`/projects/${p.id}`}
            onLinkClick={() => onOpenProject(p)}
            onSave={(name) =>
              onUpdate?.({
                id: p.id,
                name,
                toastMessage: 'Название проекта сохранено',
              })
            }
          />
        ) : (
          <Link
            to={`/projects/${p.id}`}
            className="cell-ellipsis__inner font-medium hover:underline min-w-0"
            style={{ color: 'var(--primary)' }}
            title={p.name}
            onClick={() => onOpenProject(p)}
          >
            {ellipsisText(p.name, PROJECT_TABLE_NAME_MAX)}
          </Link>
        ),
    },
    {
      title: 'Описание',
      key: 'description',
      className: 'col-desc',
      ellipsis: true,
      render: (_, p) =>
        editable ? (
          <InlineTableEdit
            value={p.description ?? ''}
            displayText={ellipsisText(p.description, PROJECT_TABLE_DESC_MAX)}
            title={p.description?.trim() || undefined}
            placeholder="Описание проекта"
            multiline
            saving={saving}
            readOnly={!canWriteProject}
            onSave={(description) =>
              onUpdate?.({
                id: p.id,
                description: description || '',
                toastMessage: 'Описание проекта сохранено',
              })
            }
          />
        ) : (
          <span style={{ color: 'var(--text-muted)' }} title={p.description?.trim() || undefined}>
            {ellipsisText(p.description, PROJECT_TABLE_DESC_MAX)}
          </span>
        ),
    },
    {
      title: 'POI',
      key: 'poi_count',
      className: 'col-center col-poi',
      align: 'center',
      width: 56,
      render: (_, p) => <span className="tabular">{p.poi_count}</span>,
    },
    {
      title: 'Статус',
      key: 'status',
      className: 'col-center col-status',
      align: 'center',
      width: 136,
      render: (_, p) =>
        editable ? (
          <ProjectStatusSelect
            value={p.status}
            disabled={saving || !canWriteProject}
            onChange={(status) =>
              onUpdate?.({
                id: p.id,
                status,
                toastMessage: 'Статус проекта обновлён',
              })
            }
          />
        ) : (
          (() => {
            const st = projectStatus(p.status);
            return <span className={`status ${st.className}`}>{st.label}</span>;
          })()
        ),
    },
    {
      title: 'Создал',
      key: 'owner_name',
      className: 'col-owner',
      ellipsis: true,
      render: (_, p) => (
        <span style={{ color: 'var(--text-muted)' }} title={p.owner_name || undefined}>
          {p.owner_name?.trim() || '—'}
        </span>
      ),
    },
    {
      title: 'Дата',
      key: 'created_at',
      className: 'col-center col-date',
      align: 'center',
      width: 88,
      render: (_, p) => formatProjectDate(p.created_at),
    },
    {
      title: '',
      key: 'actions',
      className: 'col-actions',
      align: 'right',
      width: 152,
      render: (_, p) => (
        <div className="projects-table-actions">
          <Link to={`/projects/${p.id}`} onClick={() => onOpenProject(p)}>
            <Button size="small">Открыть</Button>
          </Link>
          {canDelete?.(p) && onDelete ? (
            <Button
              size="small"
              icon={<Trash2 size={14} className="text-red-600" />}
              onClick={(e) => onDelete(p, e)}
              disabled={deletePending}
              title="Удалить проект"
              aria-label={`Удалить ${p.name}`}
            />
          ) : null}
        </div>
      ),
    },
  ];
}

export function ProjectsDataTable({
  projects,
  emptyText = 'Нет проектов',
  ...columnProps
}: ProjectsDataTableProps) {
  return (
    <AppDataTable<Project>
      className="data-table--projects"
      rowKey="id"
      columns={buildProjectsTableColumns(columnProps)}
      dataSource={projects}
      emptyText={emptyText}
      scroll={{}}
    />
  );
}
