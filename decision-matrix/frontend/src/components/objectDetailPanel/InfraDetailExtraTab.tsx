import type { InfraObject } from '../../lib/api';
import { isLineSubtype } from '../../lib/infraGeometry';
import {
  MAX_RENDER_3D_SCALE,
  MIN_RENDER_3D_SCALE,
} from '../../lib/map3d/render3d';
import { catalogEntryForSubtype } from '../../lib/map3d/map3dModelCatalog';
import { AppSelect } from '../AppSelect';
import { FieldLabel, PanelSection } from './panelUi';

interface InfraDetailExtraTabProps {
  readOnly: boolean;
  render3dHeight: string;
  setRender3dHeight: (value: string) => void;
  render3dBase: string;
  setRender3dBase: (value: string) => void;
  render3dScale: string;
  setRender3dScale: (value: string) => void;
  render3dVisible: boolean;
  setRender3dVisible: (value: boolean) => void;
  infraObject: InfraObject | null;
  render3dStyle: string;
  setRender3dStyle: (value: string) => void;
  render3dModelId: string;
  setRender3dModelId: (value: string) => void;
  render3dModelOptions: { value: string; label: string }[];
  description: string;
  setDescription: (value: string) => void;
}

export function InfraDetailExtraTab({
  readOnly,
  render3dHeight,
  setRender3dHeight,
  render3dBase,
  setRender3dBase,
  render3dScale,
  setRender3dScale,
  render3dVisible,
  setRender3dVisible,
  infraObject,
  render3dStyle,
  setRender3dStyle,
  render3dModelId,
  setRender3dModelId,
  render3dModelOptions,
  description,
  setDescription,
}: InfraDetailExtraTabProps) {
  return (
    <>
      <PanelSection title="Отображение в 3D">
        <label className="object-detail-panel__field">
          <FieldLabel>Высота (м)</FieldLabel>
          <input
            className="input object-detail-panel__input"
            type="number"
            min={0}
            step="any"
            value={render3dHeight}
            readOnly={readOnly}
            disabled={readOnly}
            onChange={(e) => setRender3dHeight(e.target.value)}
          />
        </label>
        <label className="object-detail-panel__field">
          <FieldLabel>Основание над рельефом (м)</FieldLabel>
          <input
            className="input object-detail-panel__input"
            type="number"
            min={0}
            step="any"
            value={render3dBase}
            readOnly={readOnly}
            disabled={readOnly}
            onChange={(e) => setRender3dBase(e.target.value)}
          />
        </label>
        <label className="object-detail-panel__field">
          <FieldLabel>Масштаб 3D (×)</FieldLabel>
          <input
            className="input object-detail-panel__input"
            type="number"
            min={MIN_RENDER_3D_SCALE}
            max={MAX_RENDER_3D_SCALE}
            step={0.1}
            value={render3dScale}
            readOnly={readOnly}
            disabled={readOnly}
            onChange={(e) => setRender3dScale(e.target.value)}
          />
        </label>
        <label className="object-detail-panel__field object-detail-panel__field--row">
          <FieldLabel>Видимость в 3D</FieldLabel>
          <input
            type="checkbox"
            checked={render3dVisible}
            disabled={readOnly}
            onChange={(e) => setRender3dVisible(e.target.checked)}
          />
        </label>
        {infraObject && !isLineSubtype(infraObject.subtype) && catalogEntryForSubtype(infraObject.subtype) ? (
          <>
            <label className="object-detail-panel__field">
              <FieldLabel>Стиль 3D</FieldLabel>
              <select
                className="input object-detail-panel__input"
                value={render3dStyle}
                disabled={readOnly}
                onChange={(e) => setRender3dStyle(e.target.value)}
              >
                <option value="">Модель (по умолчанию)</option>
                <option value="model">Модель</option>
                <option value="extrusion">Столбик (extrusion)</option>
              </select>
            </label>
            <label className="object-detail-panel__field">
              <FieldLabel>Модель 3D</FieldLabel>
              <AppSelect
                value={render3dModelId}
                onChange={setRender3dModelId}
                disabled={readOnly}
                options={render3dModelOptions}
              />
            </label>
          </>
        ) : null}
      </PanelSection>
      <label className="object-detail-panel__field">
        <FieldLabel>Описание</FieldLabel>
        <textarea
          className="input object-detail-panel__textarea"
          value={description}
          rows={5}
          placeholder="Комментарий к объекту…"
          readOnly={readOnly}
          disabled={readOnly}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
    </>
  );
}
