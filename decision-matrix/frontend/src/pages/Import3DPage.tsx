import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, Link } from 'react-router-dom';
import {
  ArrowRight,
  Box,
  FileBox,
  Info,
  Map as MapIcon,
  Trash2,
  Upload,
} from 'lucide-react';
import { Import3dPreview } from '../components/map3d/Import3dPreview';
import { AppSelect } from '../components/AppSelect';
import { api, SUBTYPE_LABELS, type Map3dCustomModel } from '../lib/api';
import { isLineSubtype } from '../lib/infraGeometry';
import {
  canAssignMap3dCustomModel,
  canUploadMap3dCustomModel,
} from '../lib/permissions';
import { setProjectCustomGltfAssets } from '../lib/map3d/map3dCustomAssets';
import { clearGltfPrototypeCache } from '../lib/map3d/map3dGltfLoader';
import { map3dAssignableSubtypes } from '../lib/map3d/render3dModelOptions';
import { refreshMapQueries } from '../lib/mapQueries';
import { useActiveProject } from '../hooks/useActiveProject';
import { usePermissions } from '../hooks/usePermissions';
import { useAppStore } from '../store';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function Import3dPanel({
  step,
  icon,
  title,
  subtitle,
  className = '',
  children,
}: {
  step?: number;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`card import-3d-panel card--flush ${className}`.trim()}>
      <div className="card-header import-3d-panel__header">
        <div className="import-3d-panel__title-wrap">
          {step != null ? <span className="import-3d-step">{step}</span> : null}
          <span className="import-3d-panel__icon" aria-hidden>
            {icon}
          </span>
          <div className="import-3d-panel__titles">
            <h2>{title}</h2>
            {subtitle ? <p className="import-3d-panel__subtitle">{subtitle}</p> : null}
          </div>
        </div>
      </div>
      <div className="import-3d-panel__body">{children}</div>
    </section>
  );
}

function ModelsList({
  models,
  modelsLoading,
  assignedLabel,
  canDelete,
  onDelete,
  deletePending,
  emptyHint,
}: {
  models: Map3dCustomModel[];
  modelsLoading: boolean;
  assignedLabel: (m: Map3dCustomModel) => string;
  canDelete: boolean;
  onDelete: (id: string) => void;
  deletePending: boolean;
  emptyHint: string;
}) {
  if (modelsLoading) {
    return (
      <div className="import-3d-models-section">
        <p className="import-3d-muted">Загрузка списка…</p>
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="import-3d-empty">
        <FileBox size={36} strokeWidth={1.25} aria-hidden />
        <p className="import-3d-empty__title">Моделей пока нет</p>
        <p className="import-3d-empty__hint">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="import-3d-models-section">
      <div className="import-3d-models-section__head">
        <span className="import-3d-models-count">{models.length}</span>
        <span>в проекте</span>
      </div>
      <ul className="import-3d-model-list">
        {models.map((m) => {
          const assigned = assignedLabel(m);
          const isAssigned = assigned !== '—';
          return (
            <li key={m.id} className="import-3d-model-item">
              <div className="import-3d-model-item__main">
                <span className="import-3d-model-item__name" title={m.filename}>
                  {m.filename}
                </span>
                <span className="import-3d-model-item__meta">{formatDate(m.created_at)}</span>
                {isAssigned ? (
                  <span className="import-3d-badge import-3d-badge--assigned">
                    {assigned}
                  </span>
                ) : (
                  <span className="import-3d-badge import-3d-badge--free">Не назначена</span>
                )}
              </div>
              {canDelete ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm import-3d-model-item__delete"
                  title="Удалить модель"
                  aria-label={`Удалить ${m.filename}`}
                  disabled={deletePending}
                  onClick={() => onDelete(m.id)}
                >
                  <Trash2 size={16} />
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function GlbUploadZone({
  fileInputRef,
  disabled,
  busy,
  onPick,
}: {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  disabled: boolean;
  busy: boolean;
  onPick: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');

  const syncFileName = () => {
    setFileName(fileInputRef.current?.files?.[0]?.name ?? '');
  };

  useEffect(() => {
    if (!busy) syncFileName();
  }, [busy]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled || busy) return;
    const file = e.dataTransfer.files?.[0];
    if (!file || !fileInputRef.current) return;
    if (!file.name.toLowerCase().endsWith('.glb')) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInputRef.current.files = dt.files;
    setFileName(file.name);
  };

  return (
    <div className="import-3d-upload">
      <div
        className={`import-3d-dropzone${dragOver ? ' import-3d-dropzone--active' : ''}${
          disabled ? ' import-3d-dropzone--disabled' : ''
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!disabled) fileInputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
      >
        <Upload size={28} strokeWidth={1.5} aria-hidden />
        <p className="import-3d-dropzone__title">
          {fileName ? fileName : 'Перетащите .glb сюда или нажмите для выбора'}
        </p>
        <p className="import-3d-dropzone__hint">Только GLB, до 20 МБ</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".glb"
          className="import-3d-dropzone__input"
          disabled={disabled}
          onChange={syncFileName}
        />
      </div>
      <div className="import-3d-assign-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={disabled || busy || !fileName}
          onClick={onPick}
        >
          {busy ? 'Загрузка…' : 'Загрузить на сервер'}
        </button>
        {!fileName && !disabled ? (
          <p className="import-3d-muted import-3d-assign-hint">
            Выберите файл в зоне выше, чтобы загрузить
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function Import3DPage() {
  const { user, role } = usePermissions();
  const { projectId, activeProject, hasProjects, isLoading: projectsLoading } = useActiveProject();
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [assignModelId, setAssignModelId] = useState('');
  const [assignSubtype, setAssignSubtype] = useState('');

  const canUpload = canUploadMap3dCustomModel(role);
  const canAssign = canAssignMap3dCustomModel(role, user?.id, activeProject);
  const hasPageAccess = canUpload || canAssign;

  const { data: models = [], isLoading: modelsLoading } = useQuery({
    queryKey: ['map3d-custom-models', projectId],
    queryFn: () => api.listMap3dCustomModels(projectId!),
    enabled: !!projectId && hasPageAccess,
  });

  const customModelsKey = useMemo(
    () => models.map((m) => m.id).sort().join(','),
    [models],
  );

  useEffect(() => {
    if (!projectId) {
      setProjectCustomGltfAssets('', []);
      clearGltfPrototypeCache();
      return;
    }
    setProjectCustomGltfAssets(projectId, models);
    clearGltfPrototypeCache();
  }, [projectId, models]);

  const { data: infraObjects = [] } = useQuery({
    queryKey: ['infra', projectId],
    queryFn: () => api.getInfraObjects(projectId!),
    enabled: !!projectId && canAssign,
  });

  const pointObjects = infraObjects.filter((o) => !isLineSubtype(o.subtype));

  const assignableSubtypeOptions = useMemo(
    () =>
      map3dAssignableSubtypes().map((st) => ({
        value: st,
        label: SUBTYPE_LABELS[st] ?? st,
      })),
    [],
  );

  const denied = !projectsLoading && !hasPageAccess;

  useEffect(() => {
    if (!denied) return;
    pushToast('error', 'Недостаточно прав для раздела «Импорт 3D»');
  }, [denied, pushToast]);

  const invalidateAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ['map3d-custom-models', projectId] });
    await refreshMapQueries(queryClient, projectId!);
  };

  const uploadMut = useMutation({
    mutationFn: (file: File) => api.uploadMap3dCustomModel(projectId!, file),
    onSuccess: async () => {
      pushToast('success', 'Модель загружена');
      await invalidateAll();
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (e: Error) => pushToast('error', e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (modelId: string) => api.deleteMap3dCustomModel(projectId!, modelId),
    onSuccess: async () => {
      pushToast('success', 'Модель удалена');
      await invalidateAll();
    },
    onError: (e: Error) => pushToast('error', e.message),
  });

  const assignMut = useMutation({
    mutationFn: ({ modelId, subtype }: { modelId: string; subtype: string }) =>
      api.assignMap3dCustomModel(projectId!, modelId, subtype.trim()),
    onSuccess: async () => {
      pushToast('success', 'Модель назначена подтипу');
      await invalidateAll();
    },
    onError: (e: Error) => pushToast('error', e.message),
  });

  const onUpload = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !projectId || !canUpload) return;
    uploadMut.mutate(file);
  };

  const assignedLabel = (m: Map3dCustomModel) => {
    if (!m.assigned_subtype) return '—';
    return SUBTYPE_LABELS[m.assigned_subtype] ?? m.assigned_subtype;
  };

  if (denied) {
    return <Navigate to="/" replace />;
  }

  const showUploadCard = canUpload;
  const showOwnerModelsCard = !canUpload && canAssign;
  const assignReady = Boolean(projectId && assignModelId && assignSubtype);
  const uploadStep = 1;
  const assignStep = showUploadCard ? 2 : 1;

  return (
    <div className="import-3d-page">
      <header className="page-header import-3d-page__header">
        <div>
          <h1 className="page-title">Импорт 3D</h1>
          <p className="subtitle import-3d-page__lead">
            Пользовательские GLB-модели для точечных объектов на карте в режиме 3D.
          </p>
        </div>
        <div className="import-3d-hints" role="list">
          {canUpload ? (
            <span className="import-3d-hint-pill" role="listitem">
              Загрузка — администратор
            </span>
          ) : null}
          {canAssign ? (
            <span className="import-3d-hint-pill" role="listitem">
              Назначение — владелец проекта
            </span>
          ) : null}
          <span className="import-3d-hint-pill import-3d-hint-pill--muted" role="listitem">
            Линии без glTF
          </span>
        </div>
      </header>

      {!projectsLoading && !hasProjects && (
        <div className="import-3d-alert import-3d-alert--info">
          <Info size={18} aria-hidden />
          <span>Создайте проект на странице «Проекты», чтобы работать с моделями.</span>
        </div>
      )}

      {!projectId && hasProjects && (
        <div className="import-3d-alert import-3d-alert--warn">
          <Info size={18} aria-hidden />
          <span>Выберите проект в шапке приложения.</span>
        </div>
      )}

      {!canAssign && canUpload && projectId && (
        <div className="import-3d-alert import-3d-alert--info">
          <Info size={18} aria-hidden />
          <span>
            Для назначения и превью выберите проект, владельцем которого вы являетесь.
          </span>
        </div>
      )}

      <div className={`import-3d-layout ${canAssign ? 'import-3d-layout--with-preview' : ''}`}>
        <div className="import-3d-sidebar">
          <div className="import-3d-sidebar__stack">
            {showUploadCard ? (
              <Import3dPanel
                step={uploadStep}
                icon={<Upload size={20} />}
                title="Загрузка GLB"
                subtitle="Файл сохраняется в проекте и доступен для назначения"
              >
                <GlbUploadZone
                  fileInputRef={fileInputRef}
                  disabled={!projectId}
                  busy={uploadMut.isPending}
                  onPick={onUpload}
                />
                <ModelsList
                  models={models}
                  modelsLoading={modelsLoading}
                  assignedLabel={assignedLabel}
                  canDelete
                  onDelete={(id) => deleteMut.mutate(id)}
                  deletePending={deleteMut.isPending}
                  emptyHint="После загрузки модель появится в списке и в поле «Назначение»"
                />
              </Import3dPanel>
            ) : null}

            {showOwnerModelsCard ? (
              <Import3dPanel
                icon={<FileBox size={20} />}
                title="Модели проекта"
                subtitle="Загружены администратором — выберите модель для назначения"
              >
                <ModelsList
                  models={models}
                  modelsLoading={modelsLoading}
                  assignedLabel={assignedLabel}
                  canDelete={false}
                  onDelete={() => {}}
                  deletePending={false}
                  emptyHint="Попросите администратора загрузить GLB для этого проекта"
                />
              </Import3dPanel>
            ) : null}

            {canAssign ? (
              <Import3dPanel
                step={assignStep}
                icon={<Box size={20} />}
                title="Назначение подтипу"
                subtitle="Модель станет доступна в списке на карте для всех объектов этого типа"
              >
                <div className="import-3d-assign-flow">
                  <div className="import-3d-assign-field">
                    <label className="form-label" htmlFor="import3d-assign-model">
                      3D-модель
                    </label>
                    <AppSelect
                      placeholder={
                        models.length === 0 ? 'Сначала загрузите модель' : 'Выберите модель'
                      }
                      value={assignModelId}
                      onChange={setAssignModelId}
                      disabled={!projectId || models.length === 0}
                      options={[
                        { value: '', label: '— не выбрано —' },
                        ...models.map((m) => ({ value: m.id, label: m.filename })),
                      ]}
                    />
                  </div>
                  <ArrowRight className="import-3d-assign-arrow" aria-hidden />
                  <div className="import-3d-assign-field">
                    <label className="form-label" htmlFor="import3d-assign-subtype">
                      Тип объекта
                    </label>
                    <AppSelect
                      placeholder="Выберите подтип"
                      value={assignSubtype}
                      onChange={setAssignSubtype}
                      disabled={!projectId}
                      options={[
                        { value: '', label: '— не выбрано —' },
                        ...assignableSubtypeOptions,
                      ]}
                    />
                  </div>
                </div>
                <div className="import-3d-assign-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!assignReady || assignMut.isPending}
                    onClick={() =>
                      assignMut.mutate({ modelId: assignModelId, subtype: assignSubtype })
                    }
                  >
                    {assignMut.isPending ? 'Назначение…' : 'Назначить подтипу'}
                  </button>
                  {assignReady ? (
                    <Link to="/map" className="btn btn-secondary import-3d-map-link">
                      <MapIcon size={16} aria-hidden />
                      Открыть карту 3D
                    </Link>
                  ) : (
                    <p className="import-3d-muted import-3d-assign-hint">
                      Выберите модель и тип объекта, чтобы продолжить
                    </p>
                  )}
                </div>
              </Import3dPanel>
            ) : null}
          </div>
        </div>

        {canAssign ? (
          <Import3dPanel
            className="import-3d-preview-card"
            icon={<Box size={20} />}
            title="Превью"
            subtitle="Как модель будет выглядеть на карте"
          >
            {projectId ? (
              <Import3dPreview objects={infraObjects} customModelsKey={customModelsKey} />
            ) : (
              <div className="import-3d-empty import-3d-empty--compact">
                <p className="import-3d-empty__title">Проект не выбран</p>
                <p className="import-3d-empty__hint">Укажите проект в шапке</p>
              </div>
            )}
          </Import3dPanel>
        ) : null}
      </div>
    </div>
  );
}
