"""Parse Landmark .wbp well plans via welleng.exchange.wbp."""

from __future__ import annotations

import os
import tempfile
from typing import Any

import welleng as we
from welleng.exchange import wbp

from well_trajectory.pywellgeo_bridge import enrich_survey_geometry
from well_trajectory.schemas import ImportParseResponse, ImportParseWell, SurveyStation


def _load_wbp_plans(lines: list[str]) -> list[Any]:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".wbp", delete=False, encoding="utf-8") as handle:
        handle.write("\n".join(lines))
        path = handle.name
    try:
        loaded = wbp.load(path)
        return loaded if isinstance(loaded, list) else [loaded]
    finally:
        os.unlink(path)


def _survey_from_plan(plan: Any, *, azi_reference: str = "grid") -> we.survey.Survey | None:
    try:
        return wbp.wbp_to_survey(plan, azi_reference=azi_reference)
    except (AssertionError, ImportError, ModuleNotFoundError):
        return None


def _stations_from_turn_points(plan: Any, *, azi_reference: str) -> list[SurveyStation]:
    steps = getattr(plan, "steps", None) or []
    if len(steps) < 2:
        return []

    raw: list[tuple[float, float, float, float, float, float]] = []
    for tp in steps:
        md = float(getattr(tp, "md", 0.0) or 0.0)
        inc = float(getattr(tp, "inc", 0.0) or 0.0)
        azi = float(getattr(tp, "azi", 0.0) or 0.0)
        loc = getattr(tp, "location", None) or [0.0, 0.0, 0.0]
        east = float(loc[0])
        north = float(loc[1])
        tvd = abs(float(loc[2]))
        raw.append((md, inc, azi, north, east, tvd))

    deduped: list[tuple[float, float, float, float, float, float]] = []
    for item in raw:
        if deduped and item[0] == deduped[-1][0] and item[1] == deduped[-1][1] and item[2] == deduped[-1][2]:
            deduped[-1] = item
        else:
            deduped.append(item)

    if len(deduped) < 2:
        md = [row[0] for row in deduped]
        inc = [row[1] for row in deduped]
        azi_vals = [row[2] for row in deduped]
        if len(md) >= 1:
            header = we.survey.SurveyHeader(azi_reference=azi_reference)
            survey = we.survey.Survey(md=md, inc=inc, azi=azi_vals, header=header)
            return [
                SurveyStation(
                    md=float(survey.md[i]),
                    inc=float(survey.inc_deg[i]),
                    azi=float(survey.azi_grid_deg[i]),
                    tvd=float(survey.tvd[i]),
                    n=float(survey.n[i]),
                    e=float(survey.e[i]),
                )
                for i in range(len(survey.md))
            ]
        return []

    has_positions = any(row[3] != 0.0 or row[4] != 0.0 or row[5] != 0.0 for row in deduped)
    if has_positions:
        return [
            SurveyStation(md=row[0], inc=row[1], azi=row[2], tvd=row[5], n=row[3], e=row[4])
            for row in deduped
        ]

    header = we.survey.SurveyHeader(azi_reference=azi_reference)
    survey = we.survey.Survey(
        md=[row[0] for row in deduped],
        inc=[row[1] for row in deduped],
        azi=[row[2] for row in deduped],
        header=header,
    )
    return [
        SurveyStation(
            md=float(survey.md[i]),
            inc=float(survey.inc_deg[i]),
            azi=float(survey.azi_grid_deg[i]),
            tvd=float(survey.tvd[i]),
            n=float(survey.n[i]),
            e=float(survey.e[i]),
        )
        for i in range(len(survey.md))
    ]


def _plan_to_well(plan: Any) -> ImportParseWell | None:
    name = (getattr(plan, "plan_name", None) or "Well-1").strip()
    azi_reference = "grid"
    warnings: list[str] = []

    survey = _survey_from_plan(plan, azi_reference=azi_reference)
    if survey is not None and len(survey.md) >= 2:
        stations = [
            SurveyStation(
                md=float(survey.md[i]),
                inc=float(survey.inc_deg[i]),
                azi=float(survey.azi_grid_deg[i]),
                tvd=float(survey.tvd[i]),
                n=float(survey.n[i]),
                e=float(survey.e[i]),
            )
            for i in range(len(survey.md))
        ]
    else:
        if survey is None:
            warnings.append("wbp_to_survey unavailable (utm); using turn points")
        stations = _stations_from_turn_points(plan, azi_reference=azi_reference)

    if len(stations) < 2:
        return None

    return ImportParseWell(
        name=name,
        azi_reference=azi_reference,
        stations=stations,
        geometry=enrich_survey_geometry(stations),
        warnings=warnings,
    )


def parse_wbp(data: bytes) -> ImportParseResponse:
    if not data.strip():
        return ImportParseResponse(wells=[], errors=["Empty .wbp file"])

    text = data.decode("utf-8", errors="replace")
    lines = [line.rstrip("\r") for line in text.splitlines() if line.strip()]
    if not lines:
        return ImportParseResponse(wells=[], errors=["Empty .wbp file"])

    lowered = lines[0].lower()
    if lowered.startswith("<?xml") or lowered.startswith("<"):
        return ImportParseResponse(
            wells=[],
            errors=["EDM .xml is not supported in this build; use Landmark .wbp"],
        )

    try:
        plans = _load_wbp_plans(lines)
    except Exception as exc:
        return ImportParseResponse(wells=[], errors=[f"Failed to parse .wbp: {exc}"])

    wells: list[ImportParseWell] = []
    errors: list[str] = []
    for plan in plans:
        well = _plan_to_well(plan)
        if well is None:
            name = getattr(plan, "plan_name", None) or "?"
            errors.append(f"Well plan '{name}': fewer than 2 stations")
            continue
        wells.append(well)

    return ImportParseResponse(wells=wells, errors=errors)
