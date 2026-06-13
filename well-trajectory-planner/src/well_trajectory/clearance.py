"""Anti-collision clearance via welleng IscwsaClearance."""

from __future__ import annotations

import welleng as we

from well_trajectory.schemas import (
    ClearancePairResult,
    ClearancePairsRequest,
    ClearancePairsResponse,
    ClearanceSurveyIn,
)


def _build_survey(item: ClearanceSurveyIn) -> we.survey.Survey:
    start_nev = item.start_nev if item.start_nev is not None else [0.0, 0.0, 0.0]
    return we.survey.Survey(
        md=item.md,
        inc=item.inc,
        azi=item.azi,
        n=item.n,
        e=item.e,
        tvd=item.tvd,
        header=we.survey.SurveyHeader(azi_reference=item.azi_reference),
        error_model=item.error_model,
        start_nev=start_nev,
    )


def compute_clearance_pairs(request: ClearancePairsRequest) -> ClearancePairsResponse:
    if request.method != "iscwsa":
        raise ValueError(f"Unsupported clearance method: {request.method}")

    surveys = [_build_survey(s) for s in request.surveys]
    threshold = request.threshold
    results: list[ClearancePairResult] = []

    for pair in request.pairs:
        if len(pair) != 2:
            raise ValueError("Each pair must have exactly two well indices")
        i, j = int(pair[0]), int(pair[1])
        if i < 0 or j < 0 or i >= len(surveys) or j >= len(surveys):
            raise ValueError(f"Pair indices out of range: ({i}, {j})")
        if i == j:
            raise ValueError("Pair indices must be distinct")

        clearance = we.clearance.IscwsaClearance(surveys[i], surveys[j])
        min_sf = float(clearance.sf.min())
        cc_min = float(clearance.distance_cc.min()) if hasattr(clearance, "distance_cc") else None
        results.append(
            ClearancePairResult(
                well_a=i,
                well_b=j,
                min_sf=min_sf,
                warning=min_sf < threshold,
                center_to_center_m=cc_min,
            )
        )

    return ClearancePairsResponse(pairs=results, threshold=threshold)
