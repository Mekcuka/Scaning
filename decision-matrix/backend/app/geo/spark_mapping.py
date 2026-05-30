"""Iskra (Искра) object type → decision-matrix infrastructure subtype."""

from __future__ import annotations

SPARK_TYPE_TO_SUBTYPE: dict[str, str | None] = {
    # Network joints
    "ProductionJoint": "node",
    "GasJoint": "node",
    "RoadJoint": "node",
    "MethanolJoint": "methanol_joint",
    "AdditionalJoint": "node",
    # Pipelines & roads
    "InFieldProductionPipeLine": "oil_pipeline",
    "TransmissionProductionPipeLine": "oil_pipeline",
    "GasLine": "gas_pipeline",
    "LowPressureInjectionPipeLine": "water_pipeline",
    "HighPressureInjectionPipeLine": "water_pipeline",
    "RoadLine": "autoroad",
    "SingleWiredEnergeticsLine": "power_line",
    "DoubleWiredEnergeticsLine": "power_line",
    "MethanolPipeLine": "methanol_pipeline",
    "AdditionalLine": "additional_line",
    # Area facilities → point at polygon centroid
    "CentralGatheringFacility": "gas_processing",
    "CentralProcessingFacility": "refinery",
    "DeliveryAcceptancePoint": "refinery",
    "GasProcessingFacility": "ukg",
    "GasDeliveryFacility": "tsg",
    "GasCompressorStation": "gtes",
    "CaptivePowerPlant": "gpes",
    "PowerSource": "substation",
    "SingleSubstationKit": "substation",
    "DoubleSubstationKit": "substation",
    "SingleStepUpSubstation": "substation",
    "DoubleStepUpSubstation": "substation",
    "SingleStepDownSubstation": "substation",
    "DoubleStepDownSubstation": "substation",
    "DrillingSubstationKit": "substation",
    "SingleAutomaticControlStation": "substation",
    "DoubleAutomaticControlStation": "substation",
    # Pads
    "Pad": "pad",
    "GasUtilizingWellsPad": "pad",
    "GasWellsPad": "pad",
    "WaterUtilizingWellsPad": "pad",
    "WaterSupplier": "pad",
    # Pumping / water (separate subtypes)
    "PreliminaryWaterDischargeStation": "preliminary_water_discharge_station",
    "BoosterPumpingStation": "booster_pumping_station",
    "OilPumpingStation": "oil_pumping_station",
    "GroundPumpingStation": "ground_pumping_station",
    "Sandpit": "sand_quarry",
    "MethanolFacility": "methanol_facility",
    # Iskra extras
    "AdditionalFacility": "additional_facility",
    "Offplot": "offplot",
}

SPARK_SKIP_REASON: dict[str, str] = {}
