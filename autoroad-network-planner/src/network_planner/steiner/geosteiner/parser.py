"""Parse GeoSteiner bb output (PostScript comments and FST format v3)."""

from __future__ import annotations

import re
from dataclasses import dataclass, field


class GeoSteinerParseError(ValueError):
    """Could not interpret GeoSteiner output."""


_FLOAT = r"[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?"
_PS_AT2 = re.compile(rf"@2\s+({_FLOAT})")
_PS_ATC = re.compile(rf"@C\s+({_FLOAT})\s+({_FLOAT})")
_PS_CERT_T_XY = re.compile(rf"^\s*(\d+)\s+T\s+({_FLOAT})\s+({_FLOAT})\s+S\s*$")
_PS_CERT_XY_T = re.compile(rf"^\s*({_FLOAT})\s+({_FLOAT})\s+(\d+)\s+T\s+S\s*$")
_PS_CERT_XY_XY = re.compile(
    rf"^\s*({_FLOAT})\s+({_FLOAT})\s+({_FLOAT})\s+({_FLOAT})\s+S\s*$"
)


@dataclass(frozen=True)
class GeoSteinerCertificateEdge:
    """One edge of the optimal SMT certificate."""

    terminal_index: int | None
    point_a: tuple[float, float] | None
    terminal_index_b: int | None
    point_b: tuple[float, float] | None


@dataclass(frozen=True)
class GeoSteinerSolution:
    length_m: float
    steiner_points: list[tuple[float, float]]
    certificate_edges: list[GeoSteinerCertificateEdge] = field(default_factory=list)


def _parse_certificate_edge(line: str) -> GeoSteinerCertificateEdge | None:
    match = _PS_CERT_T_XY.match(line)
    if match:
        t_idx = int(match.group(1))
        pt = (float(match.group(2)), float(match.group(3)))
        return GeoSteinerCertificateEdge(t_idx, None, None, pt)

    match = _PS_CERT_XY_T.match(line)
    if match:
        pt = (float(match.group(1)), float(match.group(2)))
        t_idx = int(match.group(3))
        return GeoSteinerCertificateEdge(None, pt, t_idx, None)

    match = _PS_CERT_XY_XY.match(line)
    if match:
        pa = (float(match.group(1)), float(match.group(2)))
        pb = (float(match.group(3)), float(match.group(4)))
        return GeoSteinerCertificateEdge(None, pa, None, pb)

    return None


def parse_bb_postscript(output: str) -> GeoSteinerSolution:
    """Extract optimal length (@2), Steiner points (@C), and certificate edges."""
    length: float | None = None
    steiner: list[tuple[float, float]] = []
    cert_edges: list[GeoSteinerCertificateEdge] = []

    for line in output.splitlines():
        if length is None:
            match = _PS_AT2.search(line)
            if match:
                length = float(match.group(1))
        for sx, sy in _PS_ATC.findall(line):
            pt = (float(sx), float(sy))
            if not steiner or steiner[-1] != pt:
                steiner.append(pt)
        edge = _parse_certificate_edge(line)
        if edge is not None:
            cert_edges.append(edge)

    if length is None:
        raise GeoSteinerParseError("GeoSteiner bb output missing @2 optimal length")
    return GeoSteinerSolution(
        length_m=length,
        steiner_points=steiner,
        certificate_edges=cert_edges,
    )


def parse_bb_fst_v3(output: str) -> GeoSteinerSolution:
    """Parse `bb -f` FST format v3 (fallback when PostScript tags are absent)."""
    lines = [line.strip() for line in output.splitlines() if line.strip()]
    if len(lines) < 10:
        raise GeoSteinerParseError("GeoSteiner FST output too short")

    idx = 4
    try:
        nterms = int(lines[idx])
        length = float(lines[idx + 1].split()[0])
    except (IndexError, ValueError) as exc:
        raise GeoSteinerParseError("invalid FST header") from exc

    idx += 6
    for _ in range(nterms):
        idx += 1
    idx += 1  # terminal_is_not_a_steiner_point flags

    nfsts = int(lines[idx])
    idx += 1

    steiner_by_key: dict[tuple[float, float], tuple[float, float]] = {}
    for _ in range(nfsts):
        idx += 1  # number_of_terminals in FST
        idx += 1  # terminal indices
        idx += 1  # FST length
        n_steiner = int(lines[idx])
        idx += 1
        steiner_start = idx
        for _s in range(n_steiner):
            x, y = lines[idx].split()[:2]
            idx += 1
        n_edges = int(lines[idx])
        idx += n_edges + 1
        status = int(lines[idx])
        idx += 1
        n_incompat = int(lines[idx])
        idx += 1
        if n_incompat:
            idx += 1

        if status != 2:
            continue
        for s in range(n_steiner):
            x, y = lines[steiner_start + s].split()[:2]
            key = (round(float(x), 9), round(float(y), 9))
            steiner_by_key[key] = (float(x), float(y))

    return GeoSteinerSolution(
        length_m=length,
        steiner_points=list(steiner_by_key.values()),
        certificate_edges=[],
    )


def parse_bb_output(output: str) -> GeoSteinerSolution:
    """Prefer PostScript certificate tags; fall back to FST v3."""
    try:
        return parse_bb_postscript(output)
    except GeoSteinerParseError:
        return parse_bb_fst_v3(output)
