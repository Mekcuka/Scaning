import { FolderOpen } from 'lucide-react';
import { Card } from 'antd';
import { AppSelect } from '../../components/AppSelect';
import type { Project } from '../../lib/api';

type Props = {
  projects: Project[];
  projectId: string | undefined;
  onProjectChange: (id: string | null) => void;
};

export function ImportProjectPanel({ projects, projectId, onProjectChange }: Props) {
  return (
    <Card size="small" className="export-setup">
      <div className="export-setup__header export-setup__header--only">
        <div className="export-setup__title-wrap">
          <span className="export-setup__icon" aria-hidden>
            <FolderOpen size={20} />
          </span>
          <div>
            <h2 className="export-setup__title">Проект для импорта</h2>
            <p className="export-setup__hint">
              Выберите проект — ниже появятся способы загрузки данных
            </p>
          </div>
        </div>

        <label className="export-project-picker__control export-setup__project-control">
          <span className="export-project-picker__eyebrow">Целевой проект</span>
          <AppSelect
            className="export-project-select"
            variant="default"
            fullWidth
            icon={<FolderOpen size={18} aria-hidden />}
            ariaLabel="Проект для импорта"
            value={projectId ?? ''}
            onChange={(id) => onProjectChange(id || null)}
            options={projects.map((project) => ({
              value: project.id,
              label: project.name,
            }))}
          />
        </label>
      </div>
    </Card>
  );
}
