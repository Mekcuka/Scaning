import { AppModal } from '../AppModal';
import { Button, Space } from 'antd';
import type { PadEarthworkSketchModalProps } from './padEarthworkSketchModalState';
import { PadEarthworkSketchPlanTab } from './PadEarthworkSketchPlanTab';
import { PadEarthworkSketchScene3dTab } from './PadEarthworkSketchScene3dTab';
import { usePadEarthworkSketchModal } from './usePadEarthworkSketchModal';

export type { PadEarthworkSketchModalProps } from './padEarthworkSketchModalState';

export function PadEarthworkSketchModal(props: PadEarthworkSketchModalProps) {
  const {
    tab,
    setTab,
    readOnly,
    onClose,
    footer: {
      handleApplyToFields,
      saveMutation,
      computeMutation,
      canCompute,
      fillM3,
      sandDemandApplied,
      setSandDemandApplied,
      onApplySandDemand,
    },
    planTabProps,
    scene3dTabProps,
  } = usePadEarthworkSketchModal(props);

  return (
    <AppModal
      title="Схема площадки"
      subtitle={
        tab === 'scene3d'
          ? 'Объём — площадка на рельефе DEM'
          : 'План (вид сверху) — прямоугольник или произвольный контур'
      }
      onClose={onClose}
      size="lg"
      overlayClassName="app-modal-overlay--pad-earthwork-sketch"
      footer={
        !readOnly ? (
          <Space wrap className="pad-earthwork-sketch-modal__footer">
            <Button onClick={onClose}>Закрыть</Button>
            <Button onClick={handleApplyToFields}>Применить к полям</Button>
            <Button
              loading={saveMutation.isPending}
              disabled={computeMutation.isPending || !canCompute}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? 'Сохранение…' : 'Сохранить'}
            </Button>
            <Button
              type="primary"
              loading={computeMutation.isPending}
              disabled={saveMutation.isPending || !canCompute}
              onClick={() => computeMutation.mutate()}
            >
              {computeMutation.isPending ? 'Расчёт…' : 'Рассчитать'}
            </Button>
            {fillM3 != null && (
              <Button
                disabled={sandDemandApplied}
                onClick={() => {
                  onApplySandDemand(fillM3);
                  setSandDemandApplied(true);
                }}
              >
                {sandDemandApplied
                  ? 'Принято'
                  : `Применить ${fillM3.toLocaleString('ru-RU')} м³ к песку`}
              </Button>
            )}
          </Space>
        ) : (
          <Button onClick={onClose}>Закрыть</Button>
        )
      }
    >
      <div className="pad-earthwork-sketch-modal">
        <div className="pad-earthwork-sketch-modal__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'plan'}
            className={`pad-earthwork-sketch-modal__tab${tab === 'plan' ? ' pad-earthwork-sketch-modal__tab--active' : ''}`}
            onClick={() => setTab('plan')}
          >
            План
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'scene3d'}
            className={`pad-earthwork-sketch-modal__tab${tab === 'scene3d' ? ' pad-earthwork-sketch-modal__tab--active' : ''}`}
            onClick={() => setTab('scene3d')}
          >
            3D
          </button>
        </div>

        {tab === 'plan' && <PadEarthworkSketchPlanTab {...planTabProps} />}

        {tab === 'scene3d' && <PadEarthworkSketchScene3dTab {...scene3dTabProps} />}
      </div>
    </AppModal>
  );
}
