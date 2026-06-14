"""Fluid-phase routing rules for PFD schematic (oil / water / gas)."""

from __future__ import annotations

from typing import Literal

from app.services.calculations import EngineeringState, is_power_generation

FluidKind = Literal["oil", "water", "gas"]

FLUID_EDGE_SUBTYPES: dict[FluidKind, frozenset[str]] = {
    "oil": frozenset({"oil_pipeline"}),
    "gas": frozenset({"gas_pipeline"}),
    "water": frozenset({"water_pipeline"}),
}

FLUID_TERMINAL_SUBTYPES: dict[FluidKind, frozenset[str]] = {
    "oil": frozenset({"refinery", "oil_pumping_station"}),
    "gas": frozenset({"gas_processing", "gtes", "gpes", "vies"}),
    "water": frozenset({"ground_pumping_station"}),
}

FLUID_BRANCH_LABELS: dict[FluidKind, str] = {
    "oil": "Нефть",
    "water": "Вода",
    "gas": "Газ",
}

OIL_PREP_LABELS: dict[str, str] = {
    "mkos": "МКОС",
    "bmupn": "БМУПН",
    "cps": "ЦПС (УПН)",
    "upsv": "УПСВ",
    "mfns": "МФНС (без подготовки)",
}

ENG_GAS_LABELS: dict[str, str] = {
    "well": "В пласт",
    "flare": "Факел",
    "power_generation": "Электрогенерация",
    "generation": "Электрогенерация",
}

WATER_FORMATION_LABEL = "В пласт"
WATER_CENTRALIZED_TERMINAL_SUBTYPE = "ground_pumping_station"

PIPELINE_SUBTYPE_BY_FLUID: dict[FluidKind, str] = {
    "oil": "oil_pipeline",
    "gas": "gas_pipeline",
    "water": "water_pipeline",
}


def active_fluids(state: EngineeringState) -> dict[FluidKind, bool]:
    """Which fluid branches appear on the schematic."""
    return {
        "oil": state.fluid_type == "oil",
        "water": state.fluid_type == "oil",
        "gas": state.fluid_type in ("oil", "gas"),
    }


def oil_needs_preparation(state: EngineeringState) -> bool:
    return state.fluid_type == "oil" and state.eng_oil_preparation != "mfns"


def oil_uses_pipeline_transport(state: EngineeringState) -> bool:
    return state.fluid_type == "oil" and state.eng_transport in ("pipeline", "marine")


def gas_uses_local_utilization(state: EngineeringState) -> bool:
    return state.eng_gas in ("well", "flare")


def water_uses_local_utilization(state: EngineeringState) -> bool:
    """Локальная закачка: вода направляется в пласт, без водопровода на схеме."""
    return state.eng_injection == "local"


def water_uses_centralized_injection(state: EngineeringState) -> bool:
    """Централизованная закачка: вода через БКНС в пласт."""
    return state.eng_injection == "centralized"


def gas_terminal_subtype(state: EngineeringState) -> str | None:
    if is_power_generation(state.eng_gas):
        return "gtes"
    if state.fluid_type == "gas" or state.eng_gas not in ("well", "flare"):
        return "gas_processing"
    return None
