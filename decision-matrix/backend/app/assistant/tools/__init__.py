"""Assistant tool registration."""

_REGISTERED = False


def register_all_tools() -> None:
    global _REGISTERED
    if _REGISTERED:
        return
    from app.assistant.tools.domain import analysis, flow, jobs, map, projects, sand_logistics

    projects.register()
    map.register()
    analysis.register()
    jobs.register()
    sand_logistics.register()
    flow.register()
    _REGISTERED = True
