"""Assistant tool registration."""

_REGISTERED = False


def register_all_tools() -> None:
    global _REGISTERED
    if _REGISTERED:
        return
    from app.assistant.tools.domain import (
        admin,
        admin_audit,
        admin_jobs,
        analysis,
        flow,
        graph,
        imports,
        jobs,
        map,
        map_mutations,
        map3d,
        one_pagers,
        projects,
        rates,
        sand_logistics,
        session,
    )

    session.register()
    projects.register()
    map.register()
    map_mutations.register()
    analysis.register()
    jobs.register()
    rates.register()
    sand_logistics.register()
    flow.register()
    graph.register()
    one_pagers.register()
    imports.register()
    map3d.register()
    admin.register()
    admin_audit.register()
    admin_jobs.register()
    _REGISTERED = True
