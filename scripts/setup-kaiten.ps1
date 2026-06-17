param(
    [Parameter(Mandatory = $true)]
    [string]$ApiToken,
    [string]$BaseUrl = "https://wowa7777.kaiten.ru/api/latest"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repoRoot ".env"
$exampleFile = Join-Path $repoRoot ".env.example"

$lines = @(
    "# Kaiten ↔ Scaning (локально, не коммитить)",
    "KAITEN_API_TOKEN=$ApiToken",
    "KAITEN_BASE_URL=$BaseUrl",
    ""
)

if (Test-Path $envFile) {
    $existing = Get-Content $envFile -Raw
    $filtered = ($existing -split "`n" | Where-Object {
        $_ -notmatch '^\s*KAITEN_'
    }) -join "`n"
    if ($filtered.Trim()) {
        $lines = @($filtered.TrimEnd(), "") + $lines
    }
} elseif (Test-Path $exampleFile) {
    $example = Get-Content $exampleFile -Raw
    $filtered = ($example -split "`n" | Where-Object {
        $_ -notmatch '^\s*KAITEN_'
    }) -join "`n"
    if ($filtered.Trim()) {
        $lines = @($filtered.TrimEnd(), "") + $lines
    }
}

Set-Content -Path $envFile -Value ($lines -join "`n") -Encoding utf8
Write-Host "Kaiten token записан в $envFile"
Write-Host "Проверка: python scripts/sync-kaiten-features.py --status"
