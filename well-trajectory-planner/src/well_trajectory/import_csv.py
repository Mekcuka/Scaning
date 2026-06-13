"""Parse inclinometry CSV into grouped well surveys."""

from __future__ import annotations

import csv
import io
import re
from collections import defaultdict

import welleng as we

from well_trajectory.pywellgeo_bridge import enrich_survey_geometry
from well_trajectory.schemas import ImportParseResponse, ImportParseWell, SurveyStation

_REQUIRED = frozenset({"well_name", "md", "inc", "azi"})

_COLUMN_ALIASES: dict[str, tuple[str, ...]] = {
    "well_name": ("well_name", "well", "name", "скважина"),
    "md": ("md", "measured_depth", "depth"),
    "inc": ("inc", "inclination", "incl"),
    "azi": ("azi", "azimuth", "az"),
    "tvd": ("tvd", "true_vertical_depth"),
    "northing": ("northing", "n", "north"),
    "easting": ("easting", "e", "east"),
    "dls": ("dls", "dogleg"),
    "wellhead_lon": ("wellhead_lon", "wh_lon", "lon"),
    "wellhead_lat": ("wellhead_lat", "wh_lat", "lat"),
    "kb_m": ("kb_m", "kb"),
    "azi_reference": ("azi_reference", "azi_ref"),
}


def _normalize_header(name: str) -> str:
    key = re.sub(r"\s+", "_", name.strip().lower())
    for canonical, aliases in _COLUMN_ALIASES.items():
        if key in aliases:
            return canonical
    return key


def _detect_delimiter(first_line: str) -> str:
    if first_line.count(";") >= first_line.count(","):
        return ";"
    return ","


def _parse_float(raw: str | None) -> float | None:
    if raw is None or str(raw).strip() == "":
        return None
    try:
        return float(str(raw).strip().replace(",", "."))
    except ValueError:
        return None


def _compute_positions(
    md: list[float],
    inc: list[float],
    azi: list[float],
    azi_reference: str,
    *,
    start_n: float = 0.0,
    start_e: float = 0.0,
) -> list[tuple[float, float, float]]:
    header = we.survey.SurveyHeader(azi_reference=azi_reference)
    survey = we.survey.Survey(
        md=md,
        inc=inc,
        azi=azi,
        start_nev=[start_n, start_e, 0.0],
        header=header,
    )
    return [(float(survey.n[i]), float(survey.e[i]), float(survey.tvd[i])) for i in range(len(md))]


def parse_csv(content: str) -> ImportParseResponse:
    text = content.strip()
    if not text:
        return ImportParseResponse(wells=[], errors=["Empty CSV file"])

    first_line = text.splitlines()[0]
    delimiter = _detect_delimiter(first_line)
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    if not reader.fieldnames:
        return ImportParseResponse(wells=[], errors=["CSV header row is missing"])

    field_map = {_orig: _normalize_header(_orig) for _orig in reader.fieldnames}
    normalized_fields = set(field_map.values())
    missing = _REQUIRED - normalized_fields
    if missing:
        return ImportParseResponse(
            wells=[],
            errors=[f"Missing required columns: {', '.join(sorted(missing))}"],
        )

    grouped: dict[str, list[dict[str, str | None]]] = defaultdict(list)
    errors: list[str] = []
    row_num = 1

    for row in reader:
        row_num += 1
        norm = {field_map[k]: v for k, v in row.items() if k in field_map}
        name = (norm.get("well_name") or "").strip()
        if not name:
            errors.append(f"Row {row_num}: empty well_name")
            continue
        md = _parse_float(norm.get("md"))
        inc = _parse_float(norm.get("inc"))
        azi = _parse_float(norm.get("azi"))
        if md is None or inc is None or azi is None:
            errors.append(f"Row {row_num} ({name}): invalid md/inc/azi")
            continue
        grouped[name].append(norm)

    wells: list[ImportParseWell] = []
    for name, rows in grouped.items():
        well_warnings: list[str] = []
        rows.sort(key=lambda r: _parse_float(r.get("md")) or 0.0)

        if len(rows) < 2:
            errors.append(f"Well '{name}': fewer than 2 stations")
            continue

        azi_ref_raw = (rows[0].get("azi_reference") or "grid").strip().lower()
        if azi_ref_raw not in ("grid", "magnetic", "true"):
            well_warnings.append(f"Unknown azi_reference '{azi_ref_raw}', using grid")
            azi_ref = "grid"
        else:
            azi_ref = azi_ref_raw  # type: ignore[assignment]

        md_list = [_parse_float(r.get("md")) or 0.0 for r in rows]
        inc_list = [_parse_float(r.get("inc")) or 0.0 for r in rows]
        azi_list = [_parse_float(r.get("azi")) or 0.0 for r in rows]

        has_ne = all(
            _parse_float(r.get("northing")) is not None and _parse_float(r.get("easting")) is not None
            for r in rows
        )
        has_tvd = all(_parse_float(r.get("tvd")) is not None for r in rows)

        if has_ne and has_tvd:
            stations = [
                SurveyStation(
                    md=md_list[i],
                    inc=inc_list[i],
                    azi=azi_list[i],
                    tvd=_parse_float(rows[i].get("tvd")) or 0.0,
                    n=_parse_float(rows[i].get("northing")) or 0.0,
                    e=_parse_float(rows[i].get("easting")) or 0.0,
                )
                for i in range(len(rows))
            ]
        else:
            positions = _compute_positions(md_list, inc_list, azi_list, azi_ref)
            stations = [
                SurveyStation(
                    md=md_list[i],
                    inc=inc_list[i],
                    azi=azi_list[i],
                    tvd=positions[i][2] if not has_tvd else (_parse_float(rows[i].get("tvd")) or 0.0),
                    n=positions[i][0] if not has_ne else (_parse_float(rows[i].get("northing")) or 0.0),
                    e=positions[i][1] if not has_ne else (_parse_float(rows[i].get("easting")) or 0.0),
                )
                for i in range(len(rows))
            ]
            if not has_tvd:
                well_warnings.append("tvd computed via welleng")
            if not has_ne:
                well_warnings.append("northing/easting computed via welleng")

        wells.append(
            ImportParseWell(
                name=name,
                azi_reference=azi_ref,
                stations=stations,
                geometry=enrich_survey_geometry(stations),
                warnings=well_warnings,
            )
        )

    return ImportParseResponse(wells=wells, errors=errors)
