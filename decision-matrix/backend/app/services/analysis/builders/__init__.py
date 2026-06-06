"""OCP registry: param_type → analysis row builder."""

from app.services.analysis.builders.external_linear import ExternalLinearBuilder
from app.services.analysis.builders.external_point import ExternalPointBuilder
from app.services.analysis.builders.internal_linear import InternalLinearBuilder
from app.services.analysis.builders.types import ParamTypeAnalysisBuilder

ANALYSIS_PARAM_BUILDERS: tuple[ParamTypeAnalysisBuilder, ...] = (
    InternalLinearBuilder(),
    ExternalLinearBuilder(),
    ExternalPointBuilder(),
)

__all__ = ["ANALYSIS_PARAM_BUILDERS", "ParamTypeAnalysisBuilder"]
