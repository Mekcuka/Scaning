"""GLB upload optimization (Draco compression when tooling available)."""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)


def _gltf_transform_cli() -> list[str] | None:
    npx = shutil.which("npx")
    if not npx:
        return None
    return [npx, "--yes", "@gltf-transform/cli"]


def _compress_with_gltf_transform(raw: bytes) -> bytes | None:
    cli = _gltf_transform_cli()
    if not cli:
        return None
    with tempfile.TemporaryDirectory(prefix="map3d-glb-") as td:
        td_path = Path(td)
        inp = td_path / "input.glb"
        out = td_path / "output.glb"
        inp.write_bytes(raw)
        try:
            subprocess.run(
                [*cli, "optimize", str(inp), str(out), "--compress", "draco"],
                check=True,
                capture_output=True,
                timeout=120,
                env={**os.environ, "npm_config_yes": "true"},
            )
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as exc:
            logger.debug("gltf-transform optimize failed: %s", exc)
            return None
        if out.is_file() and out.stat().st_size > 0:
            return out.read_bytes()
    return None


def optimize_glb_upload(raw: bytes) -> tuple[bytes, bool]:
    """Return optimized GLB bytes and whether compression was applied."""
    if len(raw) < 32:
        return raw, False
    try:
        compressed = _compress_with_gltf_transform(raw)
        if compressed and len(compressed) < len(raw):
            return compressed, True
    except Exception:
        logger.debug("optimize_glb_upload skipped", exc_info=True)
    return raw, False
