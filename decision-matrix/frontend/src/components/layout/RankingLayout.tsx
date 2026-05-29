import { NavLink, Outlet } from 'react-router-dom';
import { BarChart3, ListOrdered, SlidersHorizontal, TrendingUp } from 'lucide-react';
import { AppSelect } from '../../components/AppSelect';
import { RankingHelpPanel } from '../../components/ranking/RankingHelpPanel';
import { RankingProvider, useRankingContext } from '../../pages/ranking/rankingContext';

const TABS = [
  { to: '/ranking/results', label: 'Результаты', icon: ListOrdered },
  { to: '/ranking/criteria', label: 'Критерии', icon: SlidersHorizontal },
  { to: '/ranking/sensitivity', label: 'Чувствительность', icon: TrendingUp },
] as const;

function RankingLayoutInner() {
  const {
    pois,
    activePoiId,
    setSelectedPoiId,
    rankingSettings,
    updateSettings,
    calculate,
    calculating,
    settingsSaving,
  } = useRankingContext();

  const algorithm = rankingSettings?.algorithm || 'topsis';

  return (
    <div className="ranking-layout">
      <header className="ranking-layout__head">
        <div className="ranking-layout__title-block">
          <h1 className="ranking-layout__title">
            <BarChart3 size={22} className="inline mr-2" aria-hidden />
            Ранжирование
          </h1>
          <p className="ranking-layout__subtitle">
            Сравнение точек интереса проекта — TOPSIS / WSM (FR-9)
          </p>
        </div>
        <div className="ranking-layout__toolbar">
          <AppSelect
            variant="sm"
            ariaLabel="Точка интереса"
            value={activePoiId}
            onChange={setSelectedPoiId}
            options={pois.map((poi) => ({ value: poi.id, label: poi.name }))}
          />
          <AppSelect
            variant="sm"
            ariaLabel="Алгоритм ранжирования"
            value={algorithm}
            onChange={(v) => void updateSettings({ algorithm: v })}
            options={[
              { value: 'topsis', label: 'TOPSIS' },
              { value: 'wsm', label: 'WSM' },
            ]}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!activePoiId || calculating}
            onClick={() => calculate({ toast: true })}
          >
            {calculating ? 'Расчёт…' : 'Рассчитать'}
          </button>
        </div>
      </header>

      <nav className="parameters-subnav ranking-subnav" aria-label="Разделы ранжирования">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `parameters-subnav__tab${isActive ? ' parameters-subnav__tab--active' : ''}`
            }
          >
            <Icon size={16} aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>

      <RankingHelpPanel algorithm={algorithm} />

      {(settingsSaving || calculating) && (
        <p className="ranking-layout__status text-sm" style={{ color: 'var(--text-muted)' }}>
          {settingsSaving ? 'Сохранение настроек…' : 'Пересчёт ранжирования…'}
        </p>
      )}

      <Outlet />
    </div>
  );
}

export function RankingLayout() {
  return (
    <RankingProvider>
      <RankingLayoutInner />
    </RankingProvider>
  );
}
