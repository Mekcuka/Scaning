"""Tool category constants for chat routing (phase 7.1)."""

from __future__ import annotations


def cats(*names: str) -> frozenset[str]:
    return frozenset(names)


CAT_SESSION = "session"
CAT_PROJECTS = "projects"
CAT_MAP = "map"
CAT_JOBS = "jobs"
CAT_RATES = "rates"
CAT_ANALYSIS = "analysis"
CAT_FLOW = "flow"
CAT_ADMIN = "admin"
CAT_HELP = "help"
