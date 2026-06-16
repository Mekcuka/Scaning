import { useMemo } from 'react';
import { Layers, LineChart, MapPin, Save, Table2 } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

import { AppSelect } from '../AppSelect';
import { PageSkeleton } from '../PageSkeleton';
import { ProjectLink } from '../ProjectLink';
import { usePageHeader } from './pageHeaderContext';
import {
  PadClusteringEditorProvider,
  usePadClusteringEditorContext,
} from '../../contexts/PadClusteringEditorContext';
import {
  PadClusteringProfileSubjectProvider,
  usePadClusteringProfileSubject,
} from '../../contexts/PadClusteringProfileSubjectContext';
import { useActiveProject } from '../../hooks/useActiveProject';
import { useProjectPathBuilder } from '../../hooks/useProjectPath';
import { SUBTYPE_LABELS } from '../../lib/api';

const SUBNAV_TABS = [
  { suffix: '/pad-clustering/workspace', label: 'Куст', icon: Layers },
  { suffix: '/pad-clustering/summary', label: 'Сводка расчёта', icon: Table2 },
  { suffix: '/pad-clustering/profile', label: 'Профиль траектории', icon: LineChart },
] as const;

function PadClusteringProfileSubjectSelect() {
  const { selectedSubjectId, selectOptions, handleSubjectChange } = usePadClusteringProfileSubject();

  return (
    <div className="pad-clustering-page__pad-select">
      <span className="pad-clustering-page__select-label">Объект</span>
      <AppSelect
        options={selectOptions}
        value={selectedSubjectId}
        onChange={handleSubjectChange}
        disabled={selectOptions.length === 0}
        placeholder="Нет рассчитанных траекторий"
        ariaLabel="Объект профиля траектории"
        variant="sm"
      />
    </div>
  );
}

function PadClusteringLayoutInner() {
  const buildPath = useProjectPathBuilder();
  const location = useLocation();
  const { activeProject } = useActiveProject();
  const {
    projectId,
    pads,
    activePadId,
    infraLoading,
    readOnly,
    pad,
    handlePadChange,
    isAnyDirty,
    savePadMut,
  } = usePadClusteringEditorContext();

  const isWorkspace = location.pathname.includes('/pad-clustering/workspace/');
  const isProfile = location.pathname.includes('/pad-clustering/profile/');
  const isSummary = location.pathname.includes('/pad-clustering/summary/');

  const padSubtitle = useMemo(() => {
    if (!projectId) return 'Выберите активный проект на дашборде или в списке проектов.';
    if (isSummary) {
      return `${activeProject?.name ?? 'Проект'} · сводка по всем кустам`;
    }
    const parts = [activeProject?.name ?? 'Проект'];
    if (pad) {
      parts.push(pad.name);
      parts.push(SUBTYPE_LABELS[pad.subtype] ?? pad.subtype);
    }
    return parts.join(' · ');
  }, [activeProject?.name, isSummary, pad, projectId]);

  usePageHeader({ title: 'Кустование', subtitle: padSubtitle }, [padSubtitle]);

  if (!projectId) {
    return (
      <div className="pad-clustering-page">
        <div className="pad-clustering-page__empty-state">
          <Layers size={40} strokeWidth={1.25} aria-hidden />
          <p>Выберите активный проект на дашборде или в списке проектов.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pad-clustering-layout">
      <nav className="parameters-subnav" aria-label="Разделы кустования">
        {SUBNAV_TABS.map(({ suffix, label, icon: Icon }) => (
          <NavLink
            key={suffix}
            to={buildPath(suffix)}
            className={({ isActive }) =>
              `parameters-subnav__tab${isActive ? ' parameters-subnav__tab--active' : ''}`
            }
          >
            <Icon size={16} aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>

      <div
        className={`pad-clustering-page${isWorkspace ? '' : ' pad-clustering-page--scroll'}`}
      >
        {!isSummary ? (
          <div className="pad-clustering-page__chrome">
            <header className="pad-clustering-page__header">
              <div className="pad-clustering-page__toolbar">
                <div className="pad-clustering-page__pad-select">
                  <span className="pad-clustering-page__select-label">Куст</span>
                  <AppSelect
                    options={pads.map((p) => ({ value: p.id, label: p.name }))}
                    value={activePadId}
                    onChange={handlePadChange}
                    disabled={infraLoading || pads.length === 0}
                    placeholder={infraLoading ? 'Загрузка…' : 'Нет кустов'}
                    ariaLabel="Кустовая площадка"
                    variant="sm"
                  />
                </div>
                {isProfile && activePadId && pads.length > 0 && <PadClusteringProfileSubjectSelect />}
                {pad && (
                  <Link
                    to={`/map?select=${pad.id}`}
                    className="btn btn--ghost btn--sm pad-clustering-page__map-link"
                    title="Открыть куст на карте"
                  >
                    <MapPin size={16} aria-hidden />
                    <span className="pad-clustering-page__map-link-label">Карта</span>
                  </Link>
                )}
                <button
                  type="button"
                  className={`btn btn--primary btn--sm${isAnyDirty ? ' pad-clustering-page__save--dirty' : ''}`}
                  disabled={readOnly || !activePadId || savePadMut.isPending}
                  onClick={() => savePadMut.mutate()}
                  title={isAnyDirty ? 'Есть несохранённые изменения' : 'Сохранить параметры куста'}
                >
                  <Save size={16} aria-hidden />
                  {savePadMut.isPending
                    ? 'Сохранение…'
                    : isAnyDirty
                      ? 'Сохранить *'
                      : 'Сохранить'}
                </button>
              </div>
            </header>
          </div>
        ) : null}

        {pads.length === 0 && !infraLoading && (
          <div className="pad-clustering-page__empty-state">
            <Layers size={36} strokeWidth={1.25} aria-hidden />
            <p>
              В проекте нет кустовых площадок.{' '}
              <ProjectLink to="/map" className="link">
                Добавьте на карте нефтяной или газовый куст
              </ProjectLink>
              .
            </p>
          </div>
        )}

        {infraLoading && pads.length === 0 && <PageSkeleton lines={4} />}

        {pads.length > 0 && (isSummary || activePadId) && <Outlet />}
      </div>
    </div>
  );
}

export function PadClusteringLayout() {
  return (
    <PadClusteringEditorProvider>
      <PadClusteringProfileSubjectProvider>
        <PadClusteringLayoutInner />
      </PadClusteringProfileSubjectProvider>
    </PadClusteringEditorProvider>
  );
}
