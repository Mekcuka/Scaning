"""Default throughput_capacity_annual in infrastructure properties (FR parameters / PFD)."""

from __future__ import annotations

# Синхронизировано с frontend infraCapacity.ts DEFAULT_THROUGHPUT_CAPACITY_BY_SUBTYPE
DEFAULT_THROUGHPUT_CAPACITY_BY_SUBTYPE: dict[str, tuple[float, str]] = {
    "refinery": (5000.0, "thousand_t_per_year"),
    "oil_pumping_station": (2500.0, "thousand_t_per_year"),
    "gas_processing": (1200.0, "thousand_m3_per_year"),
    "ukg": (1000.0, "thousand_m3_per_year"),
    "tsg": (800.0, "thousand_m3_per_year"),
    "preliminary_water_discharge_station": (800.0, "thousand_t_per_year"),
    "booster_pumping_station": (600.0, "thousand_t_per_year"),
    "ground_pumping_station": (500.0, "thousand_t_per_year"),
    "methanol_facility": (500.0, "thousand_t_per_year"),
    "methanol_joint": (300.0, "thousand_t_per_year"),
}

# Подтипы без поля «Пропускная способность» (как THROUGHPUT_CAPACITY_EXCLUDED_SUBTYPES на фронте).
THROUGHPUT_CAPACITY_EXCLUDED_SUBTYPES = frozenset({
    "node",
    "oil_pad",
    "gas_pad",
    "sand_quarry",
    "offplot",
    "additional_facility",
    "substation",
    "vies",
    "gtes",
    "gpes",
    "well_bottomhole_nnb",
    "well_bottomhole_gs_heel",
    "well_bottomhole_gs_toe",
})


def apply_default_throughput_capacity(subtype: str, properties: dict | None) -> dict:
    """Записывает норматив в properties при создании/импорте, если значение ещё не задано."""
    st = subtype.lower().strip()
    props = dict(properties or {})
    if st in THROUGHPUT_CAPACITY_EXCLUDED_SUBTYPES:
        return props
    if props.get("throughput_capacity_annual") is not None:
        return props
    default = DEFAULT_THROUGHPUT_CAPACITY_BY_SUBTYPE.get(st)
    if default is None:
        return props
    value, unit = default
    props["throughput_capacity_annual"] = value
    props["capacity_unit"] = unit
    return props
