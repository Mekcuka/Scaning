import { Navigate } from 'react-router-dom';
import { ProjectLink } from '../components/ProjectLink';
import { Box, FileBox, Info, Map as MapIcon, Upload } from 'lucide-react';
import { Button } from 'antd';
import { Import3dPreview } from '../components/map3d/Import3dPreview';
import { AppSelect } from '../components/AppSelect';
import { SUBTYPE_LABELS } from '../lib/api';
import { usePageHeader } from '../components/layout/pageHeaderContext';
import { GlbUploadZone } from './import3d/GlbUploadZone';
import { Import3dPanel } from './import3d/Import3dPanel';
import { map3dModelLabel, ModelsList } from './import3d/ModelsList';
import { useImport3dWorkflow } from './import3d/useImport3dWorkflow';

export function Import3DPage() {
  const w = useImport3dWorkflow();

  usePageHeader(
    {
      title: 'Импорт 3D',
      subtitle: 'Пользовательские GLB-модели для точечных объектов на карте в режиме 3D.',
    },
    [],
  );

  if (w.denied) {
    return <Navigate to="../.." replace />;
  }

  const showUploadCard = w.canUpload;
  const assignReady = Boolean(w.projectId && w.assignModelId);
  const hasSubtypeSelection = w.assignSubtypes.length > 0;
  const modelsEmptyHint = w.canUpload
    ? 'Загрузите GLB в блоке выше — файл появится в таблице'
    : 'Попросите администратора загрузить GLB для этого проекта';
  const uploadStep = 1;
  const assignStep = showUploadCard ? 2 : 1;

  const modelsPanel = w.hasPageAccess ? (
    <Import3dPanel
      className="import-3d-models-footer"
      icon={<FileBox size={20} />}
      title="Модели проекта"
      subtitle={
        w.modelsLoading
          ? 'Загрузка…'
          : w.models.length === 0
            ? 'Список GLB в выбранном проекте'
            : `${w.models.length} ${w.models.length === 1 ? 'файл' : w.models.length < 5 ? 'файла' : 'файлов'} в проекте`
      }
    >
      <ModelsList
        models={w.models}
        modelsLoading={w.modelsLoading}
        assignedSubtypes={w.assignedSubtypesForModel}
        canDelete={w.canUpload}
        canEdit={w.canAssign}
        onDelete={w.onDeleteModel}
        onEdit={w.onEditModel}
        deletePending={w.deleteMut.isPending}
        emptyHint={modelsEmptyHint}
      />
    </Import3dPanel>
  ) : null;

  return (
    <div className="import-3d-page">
      <div className="import-3d-hints mb-4" role="list">
        {w.canUpload ? (
          <span className="import-3d-hint-pill" role="listitem">
            Загрузка — администратор
          </span>
        ) : null}
        {w.canAssign ? (
          <span className="import-3d-hint-pill" role="listitem">
            Назначение — владелец проекта
          </span>
        ) : null}
        <span className="import-3d-hint-pill import-3d-hint-pill--muted" role="listitem">
          Линии без glTF
        </span>
      </div>

      {!w.projectsLoading && !w.hasProjects && (
        <div className="import-3d-alert import-3d-alert--info">
          <Info size={18} aria-hidden />
          <span>Создайте проект на странице «Проекты», чтобы работать с моделями.</span>
        </div>
      )}

      {!w.projectId && w.hasProjects && (
        <div className="import-3d-alert import-3d-alert--warn">
          <Info size={18} aria-hidden />
          <span>Выберите проект в шапке приложения.</span>
        </div>
      )}

      {!w.canAssign && w.canUpload && w.projectId && (
        <div className="import-3d-alert import-3d-alert--info">
          <Info size={18} aria-hidden />
          <span>
            Для назначения и превью выберите проект, владельцем которого вы являетесь.
          </span>
        </div>
      )}

      <div className={`import-3d-layout ${w.canAssign ? 'import-3d-layout--with-preview' : ''}`}>
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
                  fileInputRef={w.fileInputRef}
                  disabled={!w.projectId}
                  busy={w.uploadMut.isPending}
                  targetHeightM={w.uploadTargetHeightM}
                  onTargetHeightChange={w.setUploadTargetHeightM}
                  onPick={w.onUpload}
                />
              </Import3dPanel>
            ) : null}

            {w.canAssign ? (
              <Import3dPanel
                step={assignStep}
                icon={<Box size={20} />}
                title="Назначение подтипам"
                subtitle="Модель появится в «Модель 3D» на карте для выбранных типов объектов"
              >
                <div className="import-3d-assign-field">
                  <label className="import-3d-field-label" htmlFor="import3d-assign-model">
                    3D-модель
                  </label>
                  <AppSelect
                    placeholder={
                      w.models.length === 0 ? 'Сначала загрузите модель' : 'Выберите модель'
                    }
                    value={w.assignModelId}
                    onChange={w.setAssignModelId}
                    disabled={!w.projectId || w.models.length === 0}
                    options={[
                      { value: '', label: '— не выбрано —' },
                      ...w.models.map((m) => ({ value: m.id, label: map3dModelLabel(m) })),
                    ]}
                  />
                </div>
                <fieldset
                  className="import-3d-subtype-grid-fieldset"
                  disabled={!w.projectId || !w.assignModelId}
                >
                  <legend className="import-3d-field-label">Типы объектов</legend>
                  <div className="import-3d-subtype-grid" role="group" aria-label="Типы объектов">
                    {w.assignableSubtypes.map((st) => {
                      const checked = w.assignSubtypes.includes(st);
                      const id = `import3d-subtype-${st}`;
                      return (
                        <label key={st} className="import-3d-subtype-chip" htmlFor={id}>
                          <input
                            id={id}
                            type="checkbox"
                            checked={checked}
                            onChange={() => w.toggleAssignSubtype(st)}
                          />
                          <span>{SUBTYPE_LABELS[st] ?? st}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <div className="import-3d-apply-options">
                  <label className="import-3d-apply-toggle">
                    <input
                      type="checkbox"
                      checked={w.assignApplyToObjects}
                      onChange={(e) => w.setAssignApplyToObjects(e.target.checked)}
                      disabled={!assignReady}
                    />
                    <span>Применить к объектам на карте</span>
                  </label>
                  {w.assignApplyToObjects && assignReady && hasSubtypeSelection ? (
                    <fieldset className="import-3d-apply-mode" disabled={w.assignMut.isPending}>
                      <legend className="import-3d-field-label">Режим применения</legend>
                      <label className="import-3d-apply-mode__option">
                        <input
                          type="radio"
                          name="import3d-apply-mode"
                          checked={w.assignApplyMode === 'empty_only'}
                          onChange={() => w.setAssignApplyMode('empty_only')}
                        />
                        <span>Только объекты без модели</span>
                      </label>
                      <label className="import-3d-apply-mode__option">
                        <input
                          type="radio"
                          name="import3d-apply-mode"
                          checked={w.assignApplyMode === 'all'}
                          onChange={() => w.setAssignApplyMode('all')}
                        />
                        <span>Все объекты выбранных подтипов</span>
                      </label>
                      {w.applyPreview ? (
                        <p className="import-3d-muted import-3d-apply-preview">
                          Будет обновлено: {w.applyPreview.would_update} из{' '}
                          {w.applyPreview.total_matching} подходящих объектов
                        </p>
                      ) : null}
                    </fieldset>
                  ) : null}
                </div>
                <div className="import-3d-assign-actions">
                  <Button
                    type="primary"
                    disabled={!assignReady}
                    loading={w.assignMut.isPending}
                    onClick={() => {
                      if (
                        w.assignApplyToObjects &&
                        w.assignApplyMode === 'all' &&
                        (w.applyPreview?.would_update ?? 0) > 0 &&
                        !window.confirm(
                          `Перезаписать модель 3D у ${w.applyPreview?.would_update} объектов?`,
                        )
                      ) {
                        return;
                      }
                      w.assignMut.mutate({
                        modelId: w.assignModelId,
                        subtypes: w.assignSubtypes,
                        apply_to_objects: w.assignApplyToObjects,
                        apply_mode: w.assignApplyMode,
                      });
                    }}
                  >
                    {w.assignMut.isPending ? 'Сохранение…' : 'Сохранить назначение'}
                  </Button>
                  <Button
                    disabled={!assignReady || w.assignMut.isPending}
                    onClick={() =>
                      w.assignMut.mutate({
                        modelId: w.assignModelId,
                        subtypes: [],
                        apply_to_objects: false,
                        apply_mode: w.assignApplyMode,
                      })
                    }
                  >
                    Снять все
                  </Button>
                  {assignReady && hasSubtypeSelection ? (
                    <ProjectLink to="/map">
                      <Button icon={<MapIcon size={16} aria-hidden />} className="import-3d-map-link">
                        Открыть карту 3D
                      </Button>
                    </ProjectLink>
                  ) : (
                    <p className="import-3d-muted import-3d-assign-hint">
                      Выберите модель и отметьте один или несколько подтипов
                    </p>
                  )}
                </div>
              </Import3dPanel>
            ) : null}
          </div>
          {w.canAssign ? modelsPanel : null}
        </div>

        {w.canAssign ? (
          <Import3dPanel
            className="import-3d-preview-card"
            icon={<Box size={20} />}
            title="Превью на карте"
            subtitle="Выберите объект и проверьте масштаб до публикации"
          >
            {w.projectId ? (
              <Import3dPreview objects={w.infraObjects} customModelsKey={w.customModelsKey} />
            ) : (
              <div className="import-3d-empty import-3d-empty--compact">
                <p className="import-3d-empty__title">Проект не выбран</p>
                <p className="import-3d-empty__hint">Укажите проект в шапке</p>
              </div>
            )}
          </Import3dPanel>
        ) : null}
      </div>

      {!w.canAssign ? modelsPanel : null}
    </div>
  );
}
