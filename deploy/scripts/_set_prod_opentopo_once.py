"""One-off: sync OpenTopography env from local backend/.env to prod VM. Not for commit."""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
ENV_FILE = REPO / "decision-matrix" / "backend" / ".env"
SSH_KEY = Path(r"C:\Users\user\Documents\mykey\ssh-key\ssh-key-1779903372392")
SSH_HOST = "vovavolgin91@erascaning.duckdns.org"

KEY_VARS = ("OPENTOPOGRAPHY_API_KEY", "OPENTOPOGRAPHY_DEM_TYPE", "PAD_DEM_DATA_ROOT")


def read_local_env() -> dict[str, str]:
    text = ENV_FILE.read_text(encoding="utf-8")
    out: dict[str, str] = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        out[k.strip()] = v.strip()
    return out


def main() -> int:
    env = read_local_env()
    api_key = env.get("OPENTOPOGRAPHY_API_KEY", "")
    if not api_key:
        print("OPENTOPOGRAPHY_API_KEY missing in backend/.env", file=sys.stderr)
        return 1

    pairs = [
        ("OPENTOPOGRAPHY_API_KEY", api_key),
        ("OPENTOPOGRAPHY_DEM_TYPE", env.get("OPENTOPOGRAPHY_DEM_TYPE", "COP30")),
        ("PAD_DEM_DATA_ROOT", env.get("PAD_DEM_DATA_ROOT", "/app/data/pad_dem")),
    ]

    lines = ["set -euo pipefail", "APP_ENV=/opt/decision-matrix/shared/app.env"]
    for key, value in pairs:
        esc = value.replace("'", "'\"'\"'")
        lines.append(
            f"if grep -q '^{key}=' \"$APP_ENV\" 2>/dev/null; then "
            f"sed -i 's|^{key}=.*|{key}={esc}|' \"$APP_ENV\"; "
            f"else echo '{key}={esc}' >> \"$APP_ENV\"; fi"
        )
    lines += [
        "mkdir -p /opt/decision-matrix/shared/pad_dem",
        "chmod 755 /opt/decision-matrix/shared/pad_dem",
        "grep -E '^(OPENTOPOGRAPHY_|PAD_DEM_DATA_ROOT=)' \"$APP_ENV\" | sed 's/=.*/=***/'",
        "cd /opt/decision-matrix/current && set -a && . /opt/decision-matrix/shared/deploy.env && set +a && docker compose up -d api worker",
    ]
    script = "\n".join(lines) + "\n"

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
    r = subprocess.run(cmd, input=script.encode(), capture_output=True)
    sys.stdout.write(r.stdout.decode())
    sys.stderr.write(r.stderr.decode())
    return r.returncode


if __name__ == "__main__":
    raise SystemExit(main())
