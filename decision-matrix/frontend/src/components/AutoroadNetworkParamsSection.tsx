import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { MapToolbarButton } from '../pages/map/mapPageToolbar/MapToolbarButton';
import type {
  AutoroadPlannerOptions,
  AutoroadPlannerParamScope,
  AutoroadPlannerSolver,
} from '../lib/autoroadNetworkPlannerOptions';

export type SolverStatus = {
  steinerpy: boolean;
  geosteiner: boolean;
  default_solver: string;
};

type Props = {
  options: AutoroadPlannerOptions;
  onChange: (next: AutoroadPlannerOptions) => void;
  solverStatus: SolverStatus | null;
  statusLoading?: boolean;
};

function scopeLabel(scope: AutoroadPlannerParamScope): string {
  if (scope === 'steinerpy') return 'SteinerPy';
  if (scope === 'geosteiner') return 'GeoSteiner';
  return 'Общие';
}

function solverLabel(solver: AutoroadPlannerSolver): string {
  return solver === 'geosteiner' ? 'GeoSteiner' : 'SteinerPy';
}

function NumField({
  id,
  label,
  unit,
  value,
  onChange,
  min,
  max,
  step,
}: {
  id: string;
  label: string;
  unit?: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <label className="autoroad-params__field" htmlFor={id}>
      <span className="autoroad-params__label">{label}</span>
      <span className="autoroad-params__control">
        <input
          id={id}
          type="number"
          className="autoroad-params__input autoroad-params__input--num"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {unit ? <span className="autoroad-params__unit">{unit}</span> : null}
      </span>
    </label>
  );
}

export function AutoroadNetworkParamsSection({
  options,
  onChange,
  solverStatus,
  statusLoading = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const scope = options.param_scope;

  const patch = (partial: Partial<AutoroadPlannerOptions>) => {
    onChange({ ...options, ...partial });
  };

  const setScope = (param_scope: AutoroadPlannerParamScope) => patch({ param_scope });

  const setSolver = (solver: AutoroadPlannerSolver) => {
    if (solver === 'geosteiner' && solverStatus && !solverStatus.geosteiner) return;
    if (solver === 'steinerpy' && solverStatus && !solverStatus.steinerpy) return;
    patch({ solver });
  };

  const showSteinerPyExtras = scope === 'steinerpy';
  const showGeoSteinerNote = scope === 'geosteiner';

  const collapsedSummary = `${options.connector_max_km} km · ${solverLabel(options.solver)}`;

  const statusBadges = (() => {
    if (statusLoading) return <span className="autoroad-params__badge">…</span>;
    if (!solverStatus) return null;
    return (
      <>
        <span
          className={`autoroad-params__badge ${solverStatus.steinerpy ? 'autoroad-params__badge--ok' : 'autoroad-params__badge--off'}`}
          title={solverStatus.steinerpy ? 'SteinerPy доступен' : 'SteinerPy недоступен'}
        >
          SP{solverStatus.steinerpy ? '✓' : '×'}
        </span>
        <span
          className={`autoroad-params__badge ${solverStatus.geosteiner ? 'autoroad-params__badge--ok' : 'autoroad-params__badge--off'}`}
          title={solverStatus.geosteiner ? 'GeoSteiner доступен' : 'GeoSteiner недоступен'}
        >
          GS{solverStatus.geosteiner ? '✓' : '×'}
        </span>
      </>
    );
  })();

  return (
    <div className="autoroad-params border-t border-[var(--border)]">
      <button
        type="button"
        className="autoroad-params__head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
        <span className="autoroad-params__head-title">Параметры расчёта</span>
        {!open ? (
          <span className="autoroad-params__head-summary">{collapsedSummary}</span>
        ) : null}
      </button>
      {open ? (
        <div className="autoroad-params__body">
          <div className="autoroad-params__toolbar">
            <div className="autoroad-params__status">{statusBadges}</div>
            <div
              className="map-display-mode-toggle autoroad-params__scope"
              role="group"
              aria-label="Какие параметры показать"
            >
              {(['both', 'steinerpy', 'geosteiner'] as const).map((s) => (
                <MapToolbarButton
                  key={s}
                  active={scope === s}
                  className="rounded-none border-0"
                  aria-pressed={scope === s}
                  onClick={() => setScope(s)}
                >
                  {scopeLabel(s)}
                </MapToolbarButton>
              ))}
            </div>
            {scope === 'both' ? (
              <div
                className="map-display-mode-toggle autoroad-params__solver"
                role="group"
                aria-label="Солвер расчёта"
              >
                <MapToolbarButton
                  active={options.solver === 'geosteiner'}
                  className="rounded-none border-0"
                  disabled={!!solverStatus && !solverStatus.geosteiner}
                  aria-pressed={options.solver === 'geosteiner'}
                  onClick={() => setSolver('geosteiner')}
                >
                  GS
                </MapToolbarButton>
                <MapToolbarButton
                  active={options.solver === 'steinerpy'}
                  className="rounded-none border-0"
                  disabled={!!solverStatus && !solverStatus.steinerpy}
                  aria-pressed={options.solver === 'steinerpy'}
                  onClick={() => setSolver('steinerpy')}
                >
                  SP
                </MapToolbarButton>
              </div>
            ) : null}
          </div>

          <div className="autoroad-params__form">
            <div className="autoroad-params__grid">
              <NumField
                id="autoroad-connector-max-km"
                label="Длина ребра у листа"
                unit="km"
                value={options.connector_max_km}
                min={0.001}
                max={50}
                step={0.05}
                onChange={(v) => patch({ connector_max_km: v })}
              />
              <NumField
                id="autoroad-steiner-radius-km"
                label="Радиус от терминалов"
                unit="km"
                value={options.steiner_radius_km}
                min={0}
                max={50}
                step={0.1}
                onChange={(v) => patch({ steiner_radius_km: v })}
              />
              <NumField
                id="autoroad-hub-offset-km"
                label="Смещение hub"
                unit="km"
                value={options.steiner_hub_offset_km}
                min={0}
                max={50}
                step={0.01}
                onChange={(v) => patch({ steiner_hub_offset_km: v })}
              />
              <NumField
                id="autoroad-edge-spacing-km"
                label="Шаг вершин"
                unit="km"
                value={options.edge_vertex_spacing_km}
                min={0}
                max={50}
                step={0.01}
                onChange={(v) => patch({ edge_vertex_spacing_km: v })}
              />
            </div>

            <div className="autoroad-params__checks">
              <label className="autoroad-params__check">
                <input
                  type="checkbox"
                  checked={options.enforce_attachment_radius}
                  onChange={(e) => patch({ enforce_attachment_radius: e.target.checked })}
                />
                <span>Лимит в расчёте</span>
              </label>
              <label className="autoroad-params__check">
                <input
                  type="checkbox"
                  checked={options.normalize_terminal_leaves}
                  onChange={(e) => patch({ normalize_terminal_leaves: e.target.checked })}
                />
                <span>Hub-узлы</span>
              </label>
            </div>
          </div>

          {showSteinerPyExtras ? (
            <div className="autoroad-params__extras autoroad-params__extras--sp">
              <div className="autoroad-params__grid">
                <NumField
                  id="autoroad-attachment-angle"
                  label="Угол примыкания"
                  unit="°"
                  value={options.attachment_angle_deg}
                  min={0}
                  max={180}
                  step={5}
                  onChange={(v) => patch({ attachment_angle_deg: v })}
                />
                <NumField
                  id="autoroad-attachment-penalty"
                  label="Штраф угла"
                  value={options.attachment_angle_penalty}
                  min={0}
                  max={10}
                  step={0.1}
                  onChange={(v) => patch({ attachment_angle_penalty: v })}
                />
              </div>
            </div>
          ) : null}

          {showGeoSteinerNote ? (
            <p className="autoroad-params__note autoroad-params__note--gs">
              GeoSteiner: угол и штраф не поддерживаются — только общие настройки.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
