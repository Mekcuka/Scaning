import { Link } from 'react-router-dom';
import { ProjectLink } from '../../components/ProjectLink';
import { MapPin } from 'lucide-react';
import { LINE_SUBTYPES } from '../../lib/api';
import { configuredTemplateCount } from './footprintConnectionTemplateUi';

type SaveStatus = 'idle' | 'saving' | 'error';

interface FootprintConnectionsPageHeaderProps {
  canWriteProject: boolean;
  earthworkCount: number;
  isLoadingObjects: boolean;
  configuredCount: number;
  saveStatus: SaveStatus;
}

export function FootprintConnectionsPageHeader({
  canWriteProject,
  earthworkCount,
  isLoadingObjects,
  configuredCount,
  saveStatus,
}: FootprintConnectionsPageHeaderProps) {
  const totalLineTypes = LINE_SUBTYPES.length;

  return (
    <header className="footprint-connect-page__header">
      <div className="footprint-connect-page__header-main">
        <p className="footprint-connect-page__subtitle">
          {canWriteProject
            ? 'Задайте, с какой стороны площадки подходят линии каждого типа. При применении учитывается поворот каждой площадки.'
            : 'Просмотр шаблона точек подключения линий к контуру площадки'}
        </p>
        <div className="footprint-connect-stats" role="list">
          <span className="footprint-connect-stats__chip" role="listitem">
            Типов задано:{' '}
            <strong>
              {configuredCount} / {totalLineTypes}
            </strong>
          </span>
          <span className="footprint-connect-stats__chip" role="listitem">
            Объектов на карте:{' '}
            <strong>{isLoadingObjects ? '…' : earthworkCount}</strong>
          </span>
          {canWriteProject && (
            <span
              className={`footprint-connect-save-badge footprint-connect-save-badge--${saveStatus}`}
              role="status"
            >
              {saveStatus === 'saving'
                ? 'Сохранение…'
                : saveStatus === 'error'
                  ? 'Ошибка сохранения'
                  : 'Сохранено'}
            </span>
          )}
        </div>
      </div>
      <ProjectLink to="/map" className="btn btn-secondary btn-sm shrink-0">
        <MapPin size={14} className="inline mr-1" />
        Открыть карту
      </ProjectLink>
    </header>
  );
}

export { configuredTemplateCount };
