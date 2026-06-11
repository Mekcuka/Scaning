import { Box, Calculator, Settings2, Truck, Wrench, type LucideIcon } from 'lucide-react';
import type { PoiFormValues, PoiSectionId } from '../../lib/poiParams';

export type InfraDetailTab = 'main' | 'logistics' | 'extra';
export type PoiDetailTab = 'basic' | 'engineering' | 'calculation';

export const POI_TAB_SECTIONS: Record<PoiDetailTab, PoiSectionId[]> = {
  basic: ['basic'],
  engineering: ['engineering'],
  calculation: ['thresholds', 'km_per_pad', 'max_total_line'],
};

export const POI_TAB_FIELDS: Record<PoiDetailTab, (keyof PoiFormValues)[]> = {
  basic: [
    'name',
    'description',
    'lon',
    'lat',
    'fluid_type',
    'planned_production_volume',
    'water_injection_volume',
    'gas_factor',
    'production_per_well',
    'wells_per_pad',
  ],
  engineering: [
    'eng_power',
    'eng_injection',
    'eng_gas',
    'eng_oil_preparation',
    'eng_well_gathering',
    'eng_transport',
  ],
  calculation: [
    'threshold_gas_processing_km',
    'threshold_gtes_km',
    'threshold_substation_km',
    'threshold_refinery_km',
    'km_per_pad_autoroad',
    'km_per_pad_oil_pipeline',
    'km_per_pad_gas_pipeline',
    'km_per_pad_water_pipeline',
    'km_per_pad_power_line',
    'max_total_line_autoroad_km',
    'max_total_line_oil_pipeline_km',
    'max_total_line_gas_pipeline_km',
    'max_total_line_water_pipeline_km',
    'max_total_line_power_line_km',
  ],
};

export const POI_TAB_LABELS: Record<PoiDetailTab, string> = {
  basic: 'Основное',
  engineering: 'Инженерия',
  calculation: 'Расчёт',
};

export const INFRA_TAB_ICONS: Record<InfraDetailTab, LucideIcon> = {
  main: Settings2,
  logistics: Truck,
  extra: Box,
};

export const POI_TAB_ICONS: Record<PoiDetailTab, LucideIcon> = {
  basic: Settings2,
  engineering: Wrench,
  calculation: Calculator,
};
