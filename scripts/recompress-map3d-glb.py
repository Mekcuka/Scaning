"""Batch recompress GLB files under map3d_models data directory."""

from __future__ import annotations

import argparse
from pathlib import Path

from app.services.map3d_glb_optimize import optimize_glb_upload


def main() -> None:
    parser = argparse.ArgumentParser(description='Recompress project map3d GLB files with Draco')
    parser.add_argument(
        'root',
        nargs='?',
        default='decision-matrix/backend/data/map3d_models',
        help='Root directory with project/model GLB files',
    )
    args = parser.parse_args()
    root = Path(args.root)
    if not root.is_dir():
        raise SystemExit(f'Not a directory: {root}')

    changed = 0
    for path in root.rglob('*.glb'):
        raw = path.read_bytes()
        optimized, ok = optimize_glb_upload(raw)
        if ok and optimized != raw:
            path.write_bytes(optimized)
            changed += 1
            print(f'compressed: {path}')
    print(f'done, updated {changed} file(s)')


if __name__ == '__main__':
    main()
