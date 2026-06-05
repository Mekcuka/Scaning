"""Run GeoSteiner stand-alone tools (efst | bb)."""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Iterable

from network_planner.steiner.geosteiner.config import (
    GeoSteinerPaths,
    geosteiner_runtime_path,
    geosteiner_timeout_sec,
    resolve_geosteiner_paths,
)
from network_planner.steiner.geosteiner.parser import GeoSteinerParseError, parse_bb_output


class GeoSteinerNotAvailableError(RuntimeError):
    """GeoSteiner binaries are not installed or not on PATH."""


class GeoSteinerRunError(RuntimeError):
    """GeoSteiner subprocess failed."""


def is_geosteiner_available() -> bool:
    return resolve_geosteiner_paths() is not None


def format_point_input(points: Iterable[tuple[float, float]]) -> str:
    """Whitespace-separated coordinates, one terminal per line (efst stdin).

    Scientific notation like 1e-10 is not accepted by efst on Windows;
    tiny values are flushed to 0 and coordinates are formatted as plain decimals.
    """
    lines: list[str] = []
    for x, y in points:
        if abs(x) < 1e-6:
            x = 0.0
        if abs(y) < 1e-6:
            y = 0.0
        lines.append(f"{x:.6f} {y:.6f}")
    return "\n".join(lines) + "\n"


def _subprocess_env() -> dict[str, str]:
    env = os.environ.copy()
    runtime = geosteiner_runtime_path()
    if runtime:
        env["PATH"] = runtime if not env.get("PATH") else f"{runtime}{os.pathsep}{env['PATH']}"
    return env


def _run_shell_pipeline(
    efst: Path,
    bb: Path,
    stdin_text: str,
    *,
    timeout: float,
) -> tuple[str, str, str]:
    cmd = f'"{efst}" | "{bb}"'
    try:
        proc = subprocess.run(
            cmd,
            shell=True,
            input=stdin_text,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=str(efst.parent),
            env=_subprocess_env(),
        )
    except subprocess.TimeoutExpired as exc:
        raise GeoSteinerRunError(f"GeoSteiner timed out after {timeout}s") from exc

    return proc.stdout, proc.stderr, str(proc.returncode)


def _run_tempfile_pipeline(
    efst: Path,
    bb: Path,
    stdin_text: str,
    *,
    timeout: float,
) -> tuple[str, str, str]:
    """Windows fallback: feed efst from a temp file, pipe stdout to bb."""
    env = _subprocess_env()
    with tempfile.NamedTemporaryFile("w", suffix=".pts", delete=False, encoding="utf-8") as fh:
        fh.write(stdin_text)
        pts_path = fh.name

    try:
        with open(pts_path, encoding="utf-8") as pts_file:
            efst_proc = subprocess.Popen(
                [str(efst)],
                stdin=pts_file,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                cwd=str(efst.parent),
                env=env,
            )
            bb_proc = subprocess.Popen(
                [str(bb)],
                stdin=efst_proc.stdout,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                cwd=str(bb.parent),
                env=env,
            )
            assert efst_proc.stdout is not None
            efst_proc.stdout.close()

            try:
                bb_out, bb_err = bb_proc.communicate(timeout=timeout)
                efst_proc.wait(timeout=timeout)
            except subprocess.TimeoutExpired as exc:
                bb_proc.kill()
                efst_proc.kill()
                raise GeoSteinerRunError(f"GeoSteiner timed out after {timeout}s") from exc

            efst_err = efst_proc.stderr.read() if efst_proc.stderr is not None else ""
            if bb_proc.returncode != 0:
                return bb_out, bb_err or efst_err, str(bb_proc.returncode)
            if efst_proc.returncode not in (0, None):
                return bb_out, efst_err or bb_err, str(efst_proc.returncode)
            return bb_out, bb_err or efst_err, "0"
    finally:
        Path(pts_path).unlink(missing_ok=True)


def run_efst_bb(
    points: list[tuple[float, float]],
    *,
    paths: GeoSteinerPaths | None = None,
    timeout_sec: float | None = None,
) -> str:
    """Run Euclidean FST generation + branch-and-cut; return bb stdout."""
    resolved = paths or resolve_geosteiner_paths()
    if resolved is None:
        raise GeoSteinerNotAvailableError(
            "GeoSteiner not found. Build with scripts/build_geosteiner.ps1 (Windows) "
            "or scripts/build_geosteiner.sh (Linux/macOS), or set GEOSTEINER_BIN_DIR."
        )

    if sys.platform == "win32" and geosteiner_runtime_path() is None:
        raise GeoSteinerNotAvailableError(
            "GeoSteiner Windows runtime not found. Install MSYS2 (winget install MSYS2.MSYS2) "
            "and ensure C:\\msys64\\mingw64\\bin contains MinGW DLLs."
        )

    stdin_text = format_point_input(points)
    timeout = timeout_sec if timeout_sec is not None else geosteiner_timeout_sec()

    runners = (
        [_run_shell_pipeline]
        if sys.platform != "win32"
        else [_run_shell_pipeline, _run_tempfile_pipeline]
    )

    last_error = "unknown error"
    for run in runners:
        bb_out, err_text, code = run(
            resolved.efst,
            resolved.bb,
            stdin_text,
            timeout=timeout,
        )
        if code == "0":
            return bb_out
        last_error = (err_text or bb_out or "GeoSteiner pipeline failed").strip()

    raise GeoSteinerRunError(f"GeoSteiner bb failed: {last_error}")


def solve_geosteiner_plane(
    points: list[tuple[float, float]],
    *,
    paths: GeoSteinerPaths | None = None,
    timeout_sec: float | None = None,
):
    """Run GeoSteiner and parse the optimal Euclidean SMT certificate."""
    raw = run_efst_bb(points, paths=paths, timeout_sec=timeout_sec)
    try:
        return parse_bb_output(raw)
    except GeoSteinerParseError as exc:
        raise GeoSteinerRunError(str(exc)) from exc
