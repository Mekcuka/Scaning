"""One-off: install GDAL runtime libs in prod api/worker containers."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

SSH_KEY = Path(r"C:\Users\user\Documents\mykey\ssh-key\ssh-key-1779903372392")
SSH_HOST = "vovavolgin91@erascaning.duckdns.org"

SCRIPT = """
set -euo pipefail
for c in decision-matrix-api decision-matrix-worker; do
  docker exec -u root "$c" bash -c '
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq libgdal36 libexpat1
  '
done
docker exec decision-matrix-api python -c "import rasterio; print(rasterio.__version__)"
"""


def main() -> int:
    cmd = [
        "ssh",
        "-i",
        str(SSH_KEY),
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=30",
        "-o",
        "IdentitiesOnly=yes",
        SSH_HOST,
        "bash",
        "-s",
    ]
    r = subprocess.run(cmd, input=SCRIPT.encode(), capture_output=True)
    sys.stdout.write(r.stdout.decode())
    sys.stderr.write(r.stderr.decode())
    return r.returncode


if __name__ == "__main__":
    raise SystemExit(main())
