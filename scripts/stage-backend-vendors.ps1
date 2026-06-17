# Stage microservice vendor copies for backend Docker build.
# Run from repo root before: docker compose -f deploy/docker-compose.dev.yml up --build
# CI deploy workflow runs the same steps; vendor dirs are gitignored locally.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$Backend = Join-Path $Root "decision-matrix\backend"

function Copy-Vendor($Source, $Dest) {
    if (-not (Test-Path $Source)) {
        throw "Missing source: $Source"
    }
    if (Test-Path $Dest) {
        Remove-Item -Recurse -Force $Dest
    }
    Copy-Item -Recurse -Force $Source $Dest
    Write-Host "Staged: $Dest"
}

Copy-Item -Recurse -Force (Join-Path $Root "decision-matrix\shared") (Join-Path $Backend "shared")
Write-Host "Staged: decision-matrix\backend\shared"

Copy-Vendor (Join-Path $Root "autoroad-network-planner") (Join-Path $Backend "network-planner-vendor")
Copy-Vendor (Join-Path $Root "pad-earthwork-planner") (Join-Path $Backend "pad-earthwork-vendor")
Copy-Vendor (Join-Path $Root "well-trajectory-planner") (Join-Path $Backend "well-trajectory-vendor")

Write-Host "Vendor staging complete."
