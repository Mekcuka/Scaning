"""Locate GeoSteiner stand-alone binaries (efst, bb)."""

from __future__ import annotations

import os
import shutil
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class GeoSteinerPaths:
    bin_dir: Path
    efst: Path
    bb: Path


def _project_root() -> Path:
    return Path(__file__).resolve().parents[4]


def _settings_msys2_root() -> str:
    try:
        from network_planner.config.settings import get_settings

        return get_settings().msys2_root
    except Exception:
        return os.environ.get("MSYS2_ROOT", r"C:\msys64")


def _settings_geosteiner_bin_dir() -> str | None:
    try:
        from network_planner.config.settings import get_settings

        return get_settings().geosteiner_bin_dir
    except Exception:
        return os.environ.get("GEOSTEINER_BIN_DIR")


def _msys_mingw_bin() -> Path | None:
    """MinGW runtime directory required by Windows-built efst/bb."""
    if os.name != "nt":
        return None
    msys_root = _settings_msys2_root()
    for candidate in (
        Path(msys_root) / "mingw64" / "bin",
        Path(r"C:\msys64") / "mingw64" / "bin",
    ):
        if (candidate / "libgcc_s_seh-1.dll").is_file() or (candidate / "libwinpthread-1.dll").is_file():
            return candidate
    return None


def geosteiner_runtime_path() -> str | None:
    """Extra PATH entries needed to run GeoSteiner on Windows."""
    mingw = _msys_mingw_bin()
    if mingw is None:
        return None
    return str(mingw)


def _resolve_exe(bin_dir: Path, name: str) -> Path | None:
    for candidate in (bin_dir / name, bin_dir / f"{name}.exe"):
        if candidate.is_file():
            return candidate
    found = shutil.which(name)
    if found:
        return Path(found)
    return None


def resolve_geosteiner_paths() -> GeoSteinerPaths | None:
    """Return paths when efst and bb are available, else None."""
    candidates: list[Path] = []
    env_dir = _settings_geosteiner_bin_dir()
    if env_dir:
        candidates.append(Path(env_dir))
    candidates.append(_project_root() / "vendor" / "geosteiner" / "bin")

    for bin_dir in candidates:
        efst = _resolve_exe(bin_dir, "efst")
        bb = _resolve_exe(bin_dir, "bb")
        if efst and bb:
            return GeoSteinerPaths(bin_dir=bin_dir, efst=efst, bb=bb)
    return None


def geosteiner_timeout_sec() -> float:
    try:
        from network_planner.config.settings import get_settings

        return get_settings().geosteiner_timeout_sec
    except Exception:
        raw = os.environ.get("GEOSTEINER_TIMEOUT_SEC", "300")
        return max(1.0, float(raw))
