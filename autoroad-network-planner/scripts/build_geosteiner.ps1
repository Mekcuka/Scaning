# Build GeoSteiner 5.3 (efst, bb) for Windows via MSYS2 MinGW-w64.
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/build_geosteiner.ps1
param(
    [string]$MsysRoot = 'C:\msys64',
    [string]$Version = '5.3'
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$Vendor = Join-Path $RepoRoot 'vendor\geosteiner'
$Src = Join-Path $Vendor 'src'
$Bin = Join-Path $Vendor 'bin'
$Bash = Join-Path $MsysRoot 'usr\bin\bash.exe'

if (-not (Test-Path $Bash)) {
    throw "MSYS2 not found at $MsysRoot. Install: winget install MSYS2.MSYS2"
}

New-Item -ItemType Directory -Force -Path $Src, $Bin | Out-Null

$env:GST_REPO = ($RepoRoot.Path -replace '\\', '/')
$env:GST_SRC = ($Src -replace '\\', '/')
$env:GST_BIN = ($Bin -replace '\\', '/')
$env:GST_VERSION = $Version

$bashScript = @'
set -euo pipefail
export MSYSTEM=MINGW64
export CHERE_INVOKING=1
export PATH=/mingw64/bin:/usr/bin:$PATH

pacman -Sy --noconfirm --needed mingw-w64-x86_64-gcc make tar gzip curl mingw-w64-x86_64-libtool 2>/dev/null || \
  pacman -S --noconfirm --needed mingw-w64-x86_64-gcc make tar gzip curl mingw-w64-x86_64-libtool

repo_root="$(cygpath -u "$GST_REPO")"
src_root="$(cygpath -u "$GST_SRC")"
bin_root="$(cygpath -u "$GST_BIN")"
version="$GST_VERSION"
url="https://geosteiner.net/geosteiner-${version}.tar.gz"
tarball="/tmp/geosteiner-${version}.tar.gz"

if [ ! -f "$src_root/Makefile" ]; then
  echo "Downloading GeoSteiner ${version}..."
  if ! curl -fsSL -o "$tarball" "$url"; then
    echo "Retry download without strict TLS..."
    curl -fsSLk -o "$tarball" "$url"
  fi
  rm -rf "$src_root"/*
  tar -xzf "$tarball" -C "$src_root" --strip-components=1
fi

cd "$src_root"
touch configure
CFLAGS="-O2 -std=gnu17" ./configure --with-cplex=no --with-machine="Windows-x86_64"
make -j"$(nproc 2>/dev/null || echo 2)" efst bb

mkdir -p "$bin_root"
if [ -f efst.exe ]; then
  cp -f efst.exe bb.exe "$bin_root/"
else
  cp -f efst bb "$bin_root/"
fi
echo "GeoSteiner tools installed in $bin_root"
ls -la "$bin_root"
'@

$bashScript = $bashScript -replace "`r`n", "`n"
$temp = Join-Path $env:TEMP 'build_geosteiner.sh'
[System.IO.File]::WriteAllText($temp, $bashScript, [System.Text.UTF8Encoding]::new($false))

Write-Host "Building GeoSteiner (may take several minutes)..."
& $Bash $temp
if ($LASTEXITCODE -ne 0) { throw "GeoSteiner build failed with exit code $LASTEXITCODE" }

Write-Host ""
Write-Host "Done. Set for current session:"
Write-Host "  `$env:GEOSTEINER_BIN_DIR = '$Bin'"
Write-Host "Restart uvicorn after setting the variable."
