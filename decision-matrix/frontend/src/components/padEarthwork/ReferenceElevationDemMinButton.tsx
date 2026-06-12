import { useMutation } from '@tanstack/react-query';
import { ArrowDownToLine } from 'lucide-react';
import {
  padEarthworkApi,
  type PadHeightReference,
  type PlanShapeSketch,
} from '../../lib/api/padEarthworkApi';
import {
  footprintMinElevationM,
  type PadDemPreview,
} from '../../lib/padEarthworkDemPreview';

const TITLE = 'Установить опорную отметку по минимуму рельефа в контуре площадки';
const TITLE_NO_DEM = 'Сначала загрузите DEM';

export type ReferenceElevationDemMinButtonProps = {
  projectId: string;
  objectId: string;
  sketch: PlanShapeSketch | null | undefined;
  params: PadHeightReference | null;
  demAvailable: boolean;
  readOnly?: boolean;
  preview?: PadDemPreview | null;
  className?: string;
  onApply: (referenceM: number) => void;
  onError?: (message: string) => void;
};

export function ReferenceElevationDemMinButton({
  projectId,
  objectId,
  sketch,
  params,
  demAvailable,
  readOnly = false,
  preview = null,
  className = 'pad-earthwork-dim-stepper__btn pad-earthwork-ref-dem-min-btn',
  onApply,
  onError,
}: ReferenceElevationDemMinButtonProps) {
  const canRequest = demAvailable && Boolean(sketch) && Boolean(params);

  const fetchMutation = useMutation({
    mutationFn: async () => {
      if (!sketch || !params) throw new Error('Укажите контур и высоту насыпи');
      return padEarthworkApi.fetchDemPreview(projectId, objectId, { sketch, params });
    },
    onSuccess: (data) => {
      const minM = footprintMinElevationM(data);
      if (minM == null) {
        onError?.('Не удалось определить минимум рельефа в контуре площадки');
        return;
      }
      onApply(Math.round(minM * 100) / 100);
    },
    onError: (err: Error) => onError?.(err.message || 'Ошибка загрузки preview DEM'),
  });

  const applyFromPreview = (data: PadDemPreview) => {
    const minM = footprintMinElevationM(data);
    if (minM == null) {
      onError?.('Не удалось определить минимум рельефа в контуре площадки');
      return;
    }
    onApply(Math.round(minM * 100) / 100);
  };

  const disabled = readOnly || !canRequest || fetchMutation.isPending;
  const title = !demAvailable ? TITLE_NO_DEM : TITLE;

  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      title={title}
      aria-label={title}
      onClick={() => {
        if (preview) {
          applyFromPreview(preview);
          return;
        }
        fetchMutation.mutate();
      }}
    >
      <ArrowDownToLine size={14} />
    </button>
  );
}
