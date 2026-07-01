import { useMemo } from 'react';

import { Input } from 'antd';

import type { InfraObject } from '../../lib/api';

import { isLineSubtype } from '../../lib/infraGeometry';

import { lineDiameterFieldHint } from '../../lib/map3d/map3dLineTubeRadius';

import {

  DEFAULT_RENDER_3D_SCALE,

  MAX_RENDER_3D_SCALE,

  MIN_RENDER_3D_SCALE,

  RENDER_3D_DIAMETER_KEY,

  RENDER_3D_BASE_FROM_DEM_KEY,
  RENDER_3D_HEIGHT_KEY,

  RENDER_3D_SCALE_KEY,

  resolveRender3D,

} from '../../lib/map3d/render3d';

import { catalogEntryForSubtype } from '../../lib/map3d/map3dModelCatalog';

import { AppSelect } from '../AppSelect';

import { FieldLabel, PanelSection, PanelSwitch } from './panelUi';



interface InfraDetailExtraTabProps {

  readOnly: boolean;

  render3dHeight: string;

  setRender3dHeight: (value: string) => void;

  render3dDiameter: string;

  setRender3dDiameter: (value: string) => void;

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

}



const RENDER_3D_STYLE_OPTIONS = [

  { value: '', label: 'По умолчанию' },

  { value: 'model', label: '3D-модель' },

  { value: 'extrusion', label: 'Столбик' },

] as const;



export function InfraDetailExtraTab({

  readOnly,

  render3dHeight,

  setRender3dHeight,

  render3dDiameter,

  setRender3dDiameter,

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

}: InfraDetailExtraTabProps) {

  const isLine = infraObject ? isLineSubtype(infraObject.subtype) : false;

  const isPowerLine = infraObject?.subtype === 'power_line';

  const isTubeLine = isLine && !isPowerLine;

  const showModelSection =

    Boolean(infraObject) && !isLine && Boolean(catalogEntryForSubtype(infraObject!.subtype));

  const showModelPicker = showModelSection && render3dStyle !== 'extrusion';

  const dimsDisabled = readOnly || !render3dVisible;

  const baseFromDem =
    !isLine && infraObject?.properties?.[RENDER_3D_BASE_FROM_DEM_KEY] === true;



  const normalizeScaleInput = (raw: string): string => {

    const sc = parseFloat(raw.trim().replace(',', '.'));

    if (!Number.isFinite(sc) || sc <= 0) return String(DEFAULT_RENDER_3D_SCALE);

    const clamped = Math.min(MAX_RENDER_3D_SCALE, Math.max(MIN_RENDER_3D_SCALE, sc));

    return String(clamped);

  };



  const renderPreview = useMemo(() => {

    if (!infraObject) return null;

    const hRaw = render3dHeight.trim().replace(',', '.');

    const dRaw = render3dDiameter.trim().replace(',', '.');

    const scRaw = render3dScale.trim().replace(',', '.');

    const h = hRaw ? parseFloat(hRaw) : null;

    const d = dRaw ? parseFloat(dRaw) : null;

    const sc = scRaw ? parseFloat(scRaw) : null;

    return resolveRender3D(infraObject.subtype, {

      ...(infraObject.properties ?? {}),

      ...(h != null && Number.isFinite(h) && h >= 0 ? { [RENDER_3D_HEIGHT_KEY]: h } : {}),

      ...(d != null && Number.isFinite(d) && d > 0 ? { [RENDER_3D_DIAMETER_KEY]: d } : {}),

      ...(sc != null && Number.isFinite(sc) && sc > 0 ? { [RENDER_3D_SCALE_KEY]: sc } : {}),

    });

  }, [infraObject, render3dHeight, render3dDiameter, render3dScale]);



  const primaryDimLabel = isPowerLine ? 'Высота опор' : isTubeLine ? 'Диаметр' : 'Высота';



  const primaryDimHint = isPowerLine

    ? 'Высота опор и проводов ЛЭП в 3D'

    : isTubeLine && infraObject && renderPreview

      ? lineDiameterFieldHint(infraObject.subtype, renderPreview)

      : 'Для столбика и модели';



  const primaryDimValue = isTubeLine ? render3dDiameter : render3dHeight;

  const setPrimaryDimValue = isTubeLine ? setRender3dDiameter : setRender3dHeight;



  return (

    <div className="object-detail-panel__tab-sections">

      <PanelSection title="3D на карте" card>

        <PanelSwitch

          label="Показывать в 3D"

          description="Объект виден при переключении карты в режим 3D"

          checked={render3dVisible}

          disabled={readOnly}

          onChange={setRender3dVisible}

        />



        <div

          className={`object-detail-panel__3d-dims${

            render3dVisible ? '' : ' object-detail-panel__3d-dims--muted'

          }`}

          aria-hidden={!render3dVisible}

        >

          <div className="object-detail-panel__pair-grid">

            <div className="object-detail-panel__pair-grid-row">

              <FieldLabel unit="м">{primaryDimLabel}</FieldLabel>

              <FieldLabel unit="м">
                {baseFromDem ? 'Отметка основания' : 'Подъём над рельефом'}
              </FieldLabel>

            </div>

            <div className="object-detail-panel__pair-grid-row">

              <div className="object-detail-panel__field-control">

                <Input

                  className="object-detail-panel__input"

                  type="number"

                  min={isTubeLine ? 0.1 : 0}

                  step="any"

                  value={primaryDimValue}

                  readOnly={dimsDisabled}

                  disabled={dimsDisabled}

                  onChange={(e) => setPrimaryDimValue(e.target.value)}

                />

              </div>

              <div className="object-detail-panel__field-control">

                <Input

                  className="object-detail-panel__input"

                  type="number"

                  min={0}

                  step="any"

                  value={render3dBase}

                  readOnly={dimsDisabled}

                  disabled={dimsDisabled}

                  onChange={(e) => setRender3dBase(e.target.value)}

                />

              </div>

            </div>

            <div className="object-detail-panel__pair-grid-row object-detail-panel__pair-grid-row--hints">

              <p className="object-detail-panel__hint">{primaryDimHint}</p>

              <p className="object-detail-panel__hint">
                {baseFromDem
                  ? 'Абсолютная отметка из ЦМР (обновляется при расчёте профиля)'
                  : 'Смещение основания вверх'}
              </p>

            </div>

          </div>



          <label className="object-detail-panel__field object-detail-panel__field--compact">

            <FieldLabel unit="×">Масштаб</FieldLabel>

            <Input

              className="object-detail-panel__input"

              type="number"

              min={MIN_RENDER_3D_SCALE}

              max={MAX_RENDER_3D_SCALE}

              step={0.1}

              value={render3dScale}

              readOnly={dimsDisabled}

              disabled={dimsDisabled}

              onChange={(e) => setRender3dScale(e.target.value)}

              onBlur={(e) => setRender3dScale(normalizeScaleInput(e.target.value))}

            />

            <p className="object-detail-panel__hint">

              От {MIN_RENDER_3D_SCALE} до {MAX_RENDER_3D_SCALE} · 1 — без изменений

            </p>

          </label>

        </div>

      </PanelSection>



      {showModelSection && (

        <PanelSection title="Внешний вид" card>

          <div

            className={`object-detail-panel__3d-model${

              render3dVisible ? '' : ' object-detail-panel__3d-dims--muted'

            }`}

          >

            <label className="object-detail-panel__field">

              <FieldLabel>Режим</FieldLabel>

              <AppSelect

                variant="compact"

                value={render3dStyle}

                readOnly={readOnly || !render3dVisible}

                onChange={setRender3dStyle}

                options={[...RENDER_3D_STYLE_OPTIONS]}

              />

              <p className="object-detail-panel__hint">

                «Столбик» — простая экструзия по контуру площадки

              </p>

            </label>



            {showModelPicker && (

              <label className="object-detail-panel__field">

                <FieldLabel>Модель</FieldLabel>

                <AppSelect

                  variant="compact"

                  value={render3dModelId}

                  readOnly={readOnly || !render3dVisible}

                  onChange={setRender3dModelId}

                  options={render3dModelOptions}

                />

              </label>

            )}

          </div>

        </PanelSection>

      )}

    </div>

  );

}


