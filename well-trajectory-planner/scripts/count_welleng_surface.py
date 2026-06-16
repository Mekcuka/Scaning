"""One-off: count welleng public surface vs project usage."""
from __future__ import annotations

import inspect
import pkgutil

import welleng as we

USED = {
    "connector.Connector",
    "survey.Survey",
    "survey.SurveyHeader",
    "survey.from_connections",
    "survey.Survey.interpolate_survey",
    "clearance.IscwsaClearance",
    "exchange.wbp.load",
    "exchange.wbp.wbp_to_survey",
}

mods = sorted(m.name for m in pkgutil.iter_modules(we.__path__))
total_classes = 0
total_funcs = 0
by_mod: dict[str, dict] = {}

for mod_name in mods:
    try:
        mod = __import__(f"welleng.{mod_name}", fromlist=[""])
    except Exception:
        continue
    classes = [
        n
        for n, o in inspect.getmembers(mod, inspect.isclass)
        if getattr(o, "__module__", "").startswith("welleng")
    ]
    funcs = [
        n
        for n, o in inspect.getmembers(mod, inspect.isfunction)
        if getattr(o, "__module__", "").startswith("welleng")
    ]
    by_mod[mod_name] = {"classes": len(classes), "funcs": len(funcs)}
    total_classes += len(classes)
    total_funcs += len(funcs)

print(f"top_modules={len(mods)}")
print(f"total_classes={total_classes}")
print(f"total_funcs={total_funcs}")
print(f"used_symbols={len(USED)}")
print("modules_by_class_count:")
for name, info in sorted(by_mod.items(), key=lambda x: -x[1]["classes"]):
    print(f"  {name}: classes={info['classes']} funcs={info['funcs']}")
